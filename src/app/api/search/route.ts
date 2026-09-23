import { NextRequest, NextResponse } from "next/server";

type BlueskyPost = {
  uri: string;
  author: { handle: string; displayName?: string; avatar?: string };
  record?: { text?: string; createdAt?: string };
  indexedAt?: string;
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
};

type BlueskyResponse = { posts?: BlueskyPost[] };

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const range = request.nextUrl.searchParams.get("days") || "7";

  if (!query) {
    return NextResponse.json({ error: "Enter a name or topic to search." }, { status: 400 });
  }
  if (query.length > 200 || !["1", "7", "30", "all"].includes(range)) {
    return NextResponse.json({ error: "Invalid search or date range." }, { status: 400 });
  }

  const cutoff = range === "all" ? null : Date.now() - Number(range) * 86_400_000;
  const endpoints = [
    { url: "https://api.bsky.app/xrpc/app.bsky.feed.searchPostsV2", queryKey: "query", sort: "recent" },
    { url: "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts", queryKey: "q", sort: "latest" },
    { url: "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts", queryKey: "q", sort: "latest" },
  ];
  let lastStatus = 502;

  for (const endpoint of endpoints) {
    try {
      const params = new URLSearchParams({ [endpoint.queryKey]: query, limit: "50", sort: endpoint.sort });
      const response = await fetch(`${endpoint.url}?${params}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        lastStatus = response.status;
        continue;
      }

      const data = (await response.json()) as BlueskyResponse;
      const posts = (data.posts || [])
        .filter((post) => post.uri && post.author?.handle)
        .map((post) => {
          const handle = post.author.handle;
          const createdAt = post.record?.createdAt || post.indexedAt || "";
          const recordKey = post.uri.split("/").at(-1) || "";
          return {
            id: post.uri,
            author: post.author.displayName || handle,
            handle,
            avatar: post.author.avatar,
            text: post.record?.text || "",
            createdAt,
            likes: post.likeCount || 0,
            replies: post.replyCount || 0,
            reposts: post.repostCount || 0,
            quotes: post.quoteCount || 0,
            url: `https://bsky.app/profile/${encodeURIComponent(handle)}/post/${encodeURIComponent(recordKey)}`,
          };
        })
        .filter((post) => post.text && post.createdAt && (!cutoff || Date.parse(post.createdAt) >= cutoff))
        .slice(0, 25);

      return NextResponse.json({ posts, query, platform: "Bluesky", fetchedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Bluesky search failed", error);
    }
  }

  const error = lastStatus === 429
    ? "Bluesky is receiving too many searches. Try again shortly."
    : "Bluesky search is temporarily unavailable.";
  return NextResponse.json({ error }, { status: lastStatus === 429 ? 429 : 502 });
}
