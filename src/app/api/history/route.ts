import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(request: NextRequest) {
  // This prototype has no user accounts: never expose shared-data deletion
  // on a public deployment until authenticated ownership is implemented.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Clearing shared history is available in the local development dashboard only." }, { status: 403 });
  }
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  try {
    if (!host || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) || !origin || new URL(origin).host !== host) throw new Error();
  } catch {
    return NextResponse.json({ error: "Clear history from the local dashboard." }, { status: 403 });
  }
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Confirmation is required." }, { status: 400 });
  }
  if (body?.confirmation !== "clear-saved-searches") {
    return NextResponse.json({ error: "Confirmation is required." }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  // The schema's ON DELETE CASCADE removes linked mentions atomically.
  const { error, count } = await supabase.from("searches").delete({ count: "exact" }).lte("searched_at", new Date().toISOString());
  if (error) return NextResponse.json({ error: "Could not clear saved searches. Please try again." }, { status: 500 });
  return NextResponse.json({ deleted: count ?? 0 });
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ history: [], configured: false }, { status: 503 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid saved search." }, { status: 400 });
    }
    const { data: search, error: searchError } = await supabase.from("searches")
      .select("id,query,platform,days,searched_at").eq("id", id).maybeSingle();
    if (searchError) return NextResponse.json({ error: "Could not load saved search." }, { status: 500 });
    if (!search) return NextResponse.json({ error: "Saved search not found." }, { status: 404 });
    const { data: mentions, error: mentionsError } = await supabase.from("mentions")
      .select("external_id,author,handle,avatar_url,content,published_at,likes,replies,reposts,quotes,post_url")
      .eq("search_id", id).order("published_at", { ascending: false });
    if (mentionsError) return NextResponse.json({ error: "Could not load saved mentions." }, { status: 500 });
    return NextResponse.json({
      search,
      posts: (mentions || []).map(mention => ({
        id: mention.external_id,
        author: mention.author,
        handle: mention.handle,
        avatar: mention.avatar_url || undefined,
        text: mention.content,
        createdAt: mention.published_at,
        likes: mention.likes,
        replies: mention.replies,
        reposts: mention.reposts,
        quotes: mention.quotes,
        url: mention.post_url,
        platform: search.platform,
      })),
    });
  }

  const { data, error } = await supabase
    .from("searches")
    .select("id,query,platform,days,mentions_count,total_engagement,searched_at")
    .order("searched_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Could not load search history", error.message);
    return NextResponse.json(
      { history: [], configured: true, error: "Search history is not ready yet." },
      { status: 503 },
    );
  }

  return NextResponse.json({ history: data, configured: true });
}
