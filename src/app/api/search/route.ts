import { NextRequest, NextResponse } from "next/server";

import { saveSearchSnapshot } from "@/lib/search-history";
import { matchesSearchFilters, parseSearchFilters, type SearchFilters } from "@/lib/search-filters";

type SearchPost = {
  id: string;
  author: string;
  handle: string;
  avatar?: string;
  text: string;
  createdAt: string;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  url: string;
};

type BlueskyPost = {
  uri: string;
  author: { handle: string; displayName?: string; avatar?: string };
  record?: unknown;
  indexedAt?: string;
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
};

type BlueskyResponse = { posts?: BlueskyPost[] };

type XPost = {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
    quote_count?: number;
  };
};

type XUser = {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
};

type XResponse = {
  data?: XPost[];
  includes?: { users?: XUser[] };
  errors?: Array<{ title?: string }>;
};

function recordDetails(record: unknown) {
  if (!record || typeof record !== "object") {
    return { text: "", createdAt: undefined };
  }

  const value = record as { text?: unknown; createdAt?: unknown };
  return {
    text: typeof value.text === "string" ? value.text : "",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
  };
}

function blueskyPostUrl(uri: string, handle: string) {
  const recordKey = uri.split("/").at(-1);
  return recordKey
    ? `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${encodeURIComponent(recordKey)}`
    : `https://bsky.app/profile/${encodeURIComponent(handle)}`;
}

function xErrorMessage(status: number) {
  if (status === 401) return "The X Bearer Token is invalid or expired.";
  if (status === 402) return "X API credits are required before searching.";
  if (status === 403) return "This X application does not have permission to search posts.";
  if (status === 429) return "The X API rate limit was reached. Try again later.";
  return "X search is temporarily unavailable.";
}

async function searchX(query: string, days: number, limit: number, filters: SearchFilters) {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    return NextResponse.json(
      { error: "Add X_BEARER_TOKEN to .env.local, then restart the dashboard." },
      { status: 503 },
    );
  }

  const params = new URLSearchParams({
    query: `${query} -is:retweet`,
    max_results: String(limit),
    start_time: new Date(Date.now() - days * 86_400_000).toISOString(),
    "tweet.fields": "author_id,created_at,public_metrics",
    expansions: "author_id",
    "user.fields": "name,username,profile_image_url",
  });

  try {
    const response = await fetch(`https://api.x.com/2/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${bearerToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    const data = (await response.json()) as XResponse;

    if (!response.ok) {
      console.error("X search failed", response.status, data.errors?.[0]?.title);
      return NextResponse.json({ error: xErrorMessage(response.status) }, { status: response.status });
    }

    const users = new Map((data.includes?.users || []).map((user) => [user.id, user]));
    const posts: SearchPost[] = (data.data || []).map((post) => {
      const author = post.author_id ? users.get(post.author_id) : undefined;
      const handle = author?.username || "unknown";
      return {
        id: post.id,
        author: author?.name || handle,
        handle,
        avatar: author?.profile_image_url,
        text: post.text,
        createdAt: post.created_at || new Date().toISOString(),
        likes: post.public_metrics?.like_count || 0,
        replies: post.public_metrics?.reply_count || 0,
        reposts: post.public_metrics?.retweet_count || 0,
        quotes: post.public_metrics?.quote_count || 0,
        url: `https://x.com/${handle}/status/${post.id}`,
      };
    }).filter(post => matchesSearchFilters(post.text, filters));

    const saved = await saveSearchSnapshot({ query, platform: "X", days, posts });
    return NextResponse.json({
      posts,
      query,
      platform: "X",
      fetchedAt: new Date().toISOString(),
      fetchedCount: data.data?.length || 0,
      saved,
    });
  } catch (error) {
    console.error("X search request failed", error);
    return NextResponse.json({ error: "Could not reach X. Please try again." }, { status: 502 });
  }
}

async function searchBluesky(query: string, days: number, limit: number, filters: SearchFilters) {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const endpoints = [
    {
      url: "https://api.bsky.app/xrpc/app.bsky.feed.searchPostsV2",
      params: new URLSearchParams({ query, limit: String(limit), sort: "recent", since: cutoff.toISOString() }),
    },
    {
      url: "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts",
      params: new URLSearchParams({ q: query, limit: String(limit), sort: "latest" }),
    },
    {
      url: "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts",
      params: new URLSearchParams({ q: query, limit: String(limit), sort: "latest" }),
    },
  ];
  let lastStatus = 502;
  const statuses = new Set<number>();

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint.url}?${endpoint.params}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 SnowlaxDashboard/0.1",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        lastStatus = response.status;
        statuses.add(response.status);
        continue;
      }

      const data = (await response.json()) as BlueskyResponse;
      const eligiblePosts: SearchPost[] = (data.posts || [])
        .map((post) => {
          const record = recordDetails(post.record);
          const handle = post.author.handle;
          return {
            id: post.uri,
            author: post.author.displayName || handle,
            handle,
            avatar: post.author.avatar,
            text: record.text,
            createdAt: record.createdAt || post.indexedAt || new Date().toISOString(),
            likes: post.likeCount || 0,
            replies: post.replyCount || 0,
            reposts: post.repostCount || 0,
            quotes: post.quoteCount || 0,
            url: blueskyPostUrl(post.uri, handle),
          };
        })
        .filter((post) => new Date(post.createdAt) >= cutoff);
      const posts = eligiblePosts
        .filter((post) => matchesSearchFilters(post.text, filters))
        .slice(0, limit);

      const saved = await saveSearchSnapshot({ query, platform: "Bluesky", days, posts });
      return NextResponse.json({
        posts,
        query,
        platform: "Bluesky",
        fetchedAt: new Date().toISOString(),
        fetchedCount: eligiblePosts.length,
        saved,
      });
    } catch (error) {
      console.error(`Bluesky search request failed through ${endpoint.url}`, error);
    }
  }

  if (statuses.has(400)) {
    return NextResponse.json(
      { error: "Bluesky could not understand that search. Try a simpler term." },
      { status: 400 },
    );
  }
  if (statuses.has(429)) {
    return NextResponse.json(
      { error: "Bluesky is receiving too many searches. Try again shortly." },
      { status: 429 },
    );
  }
  return NextResponse.json(
    { error: "Bluesky search is temporarily unavailable." },
    { status: lastStatus },
  );
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const days = request.nextUrl.searchParams.get("days") === "1" ? 1 : 7;
  const platform = request.nextUrl.searchParams.get("platform") === "x" ? "x" : "bluesky";
  const requestedLimit = request.nextUrl.searchParams.get("limit") ?? "25";
  const limit = Number(requestedLimit);
  const filters = parseSearchFilters(request.nextUrl.searchParams.get("include") || "", request.nextUrl.searchParams.get("exclude") || "");

  if (!query) {
    return NextResponse.json({ error: "Enter a name or topic to search." }, { status: 400 });
  }
  if (query.length > 200) {
    return NextResponse.json({ error: "Keep the search term under 200 characters." }, { status: 400 });
  }
  if (![10, 25, 50, 100].includes(limit)) {
    return NextResponse.json({ error: "Choose 10, 25, 50, or 100 mentions per platform." }, { status: 400 });
  }
  if (!filters) {
    return NextResponse.json({ error: "Use at most eight comma-separated phrases per filter, up to 60 characters each." }, { status: 400 });
  }

  return platform === "x" ? searchX(query, days, limit, filters) : searchBluesky(query, days, limit, filters);
}
