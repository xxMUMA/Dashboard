import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Search = { id: string; query: string; platform: string; days: number; mentions_count: number; total_engagement: number; searched_at: string };

function topicKey(search: Search) {
  return `${search.query.trim().replace(/\s+/g, " ").toLocaleLowerCase("en")}\0${search.platform}\0${search.days}`;
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });

  const { data: searches, error: searchError } = await supabase
    .from("searches")
    .select("id,query,platform,days,mentions_count,total_engagement,searched_at")
    .order("searched_at", { ascending: false })
    .limit(200);
  if (searchError) return NextResponse.json({ error: "Could not load saved search." }, { status: 503 });
  const recent = (searches ?? []) as Search[];
  const seen = new Set<string>();
  const topics: Search[] = [];
  for (const item of recent) {
    const key = topicKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    topics.push(item);
  }
  const selectedId = request.nextUrl.searchParams.get("searchId");
  const search = topics.find(topic => topic.id === selectedId) ?? topics[0] ?? null;
  if (!search) return NextResponse.json({ search: null, topics: [], snapshots: [], mentions: [] });

  const snapshots = recent.filter(item => topicKey(item) === topicKey(search)).reverse().slice(-20);

  const { data: mentions, error: mentionsError } = await supabase
    .from("mentions")
    .select("id,author,content,published_at,likes,replies,reposts,quotes,post_url,platform")
    .eq("search_id", search.id)
    .order("published_at", { ascending: true })
    .limit(200);
  if (mentionsError) return NextResponse.json({ error: "Could not load saved mentions." }, { status: 503 });
  return NextResponse.json({ search, topics, snapshots, mentions: mentions ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
