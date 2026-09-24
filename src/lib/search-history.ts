import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type PersistedPost = {
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

type SaveSearchInput = {
  query: string;
  platform: "Bluesky" | "X";
  days: number;
  posts: PersistedPost[];
};

export async function saveSearchSnapshot({ query, platform, days, posts }: SaveSearchInput) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const totalEngagement = posts.reduce(
    (total, post) => total + post.likes + post.replies + post.reposts + post.quotes,
    0,
  );

  const { data: search, error: searchError } = await supabase
    .from("searches")
    .insert({
      query,
      platform: platform.toLowerCase(),
      days,
      mentions_count: posts.length,
      total_engagement: totalEngagement,
    })
    .select("id")
    .single();

  if (searchError || !search) {
    console.error("Could not save search history", searchError?.message);
    return false;
  }

  if (posts.length === 0) return true;

  const { error: mentionsError } = await supabase.from("mentions").insert(
    posts.map((post) => ({
      search_id: search.id,
      external_id: post.id,
      platform: platform.toLowerCase(),
      author: post.author,
      handle: post.handle,
      avatar_url: post.avatar || null,
      content: post.text,
      published_at: post.createdAt,
      likes: post.likes,
      replies: post.replies,
      reposts: post.reposts,
      quotes: post.quotes,
      post_url: post.url,
    })),
  );

  if (mentionsError) {
    console.error("Could not save mentions", mentionsError.message);
    await supabase.from("searches").delete().eq("id", search.id);
    return false;
  }

  return true;
}
