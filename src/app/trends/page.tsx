"use client";

import { useEffect, useMemo, useState } from "react";
import TrackingChart from "./TrackingChart";
import DashboardSidebar from "../DashboardSidebar";

type Mention = { id: number; author: string; content: string; published_at: string; likes: number; replies: number; reposts: number; quotes: number; post_url: string };
type Search = { id: string; query: string; platform: string; days: number; searched_at: string; mentions_count: number; total_engagement: number };
type TrendsResponse = { search: Search | null; topics: Search[]; snapshots: Search[]; mentions: Mention[]; error?: string };
type ActivityBucket = { time: number; posts: Mention[]; mentions: number; engagement: number };
type PostSort = "latest" | "top-engagement";

const engagement = (post: Mention) => post.likes + post.replies + post.reposts + post.quotes;
const dateLabel = (value: string | number) => new Date(value).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function TrendsPage() {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const [postSort, setPostSort] = useState<PostSort>("latest");

  useEffect(() => {
    let active = true;
    const url = selectedId ? `/api/trends?searchId=${encodeURIComponent(selectedId)}` : "/api/trends";
    fetch(url, { cache: "no-store" }).then(async response => {
      const body = (await response.json()) as TrendsResponse;
      if (!response.ok) throw new Error(body.error || "Could not load saved trends.");
      if (active) setData(body);
    }).catch(error => {
      if (active) setData({ search: null, topics: [], snapshots: [], mentions: [], error: error instanceof Error ? error.message : "Could not load saved trends." });
    });
    return () => { active = false; };
  }, [selectedId]);

  const buckets = useMemo<ActivityBucket[]>(() => {
    if (!data?.search) return [];
    const end = new Date(data.search.searched_at).getTime();
    const days = data.search.days;
    const step = days === 1 ? 3 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const count = days === 1 ? 8 : 7;
    const start = end - count * step;
    return Array.from({ length: count }, (_, index) => {
      const time = start + index * step;
      const posts = data.mentions.filter(post => {
        const published = new Date(post.published_at).getTime();
        return published >= time && published < time + step;
      });
      return { time, posts, mentions: posts.length, engagement: posts.reduce((sum, post) => sum + engagement(post), 0) };
    });
  }, [data]);

  const peak = buckets.reduce((best, bucket, index) => bucket.mentions > (buckets[best]?.mentions ?? -1) ? index : best, 0);
  const active = selectedBucket ?? peak;
  const sortedPosts = useMemo(() => [...(buckets[active]?.posts ?? [])].sort((a, b) => {
    const byDate = new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    return postSort === "top-engagement" ? engagement(b) - engagement(a) || byDate : byDate || engagement(b) - engagement(a);
  }), [buckets, active, postSort]);
  const maxMentions = Math.max(1, ...buckets.map(bucket => bucket.mentions));
  const maxEngagement = Math.max(1, ...buckets.map(bucket => bucket.engagement));
  const activityX = (index: number) => 5 + index * 90 / Math.max(1, buckets.length - 1);
  const activityY = (value: number, max: number) => 86 - value * 70 / max;
  const mentionsLine = buckets.map((bucket, index) => `${activityX(index)},${activityY(bucket.mentions, maxMentions)}`).join(" ");
  const engagementLine = buckets.map((bucket, index) => `${activityX(index)},${activityY(bucket.engagement, maxEngagement)}`).join(" ");

  return <main className="trends-page">
    <DashboardSidebar />
    <header className="trends-header"><span className="topbar-section">Trend tracking</span><span>SAVED SEARCH INSIGHTS</span></header>
    <div className="trends-content">
      <p className="section-label">SAVED SEARCH INSIGHTS</p>
      <h1>Track how a topic<br />changes over time.</h1>
      {!data && <p>Loading saved searches…</p>}
      {data?.error && <p className="message error">{data.error}</p>}
      {data && !data.error && !data.search && <p className="message">Run a search first. Each saved search becomes a point in its trend history.</p>}
      {data?.search && <>
        <div className="trends-toolbar">
          <label htmlFor="tracked-topic">TRACKING TOPIC
            <select id="tracked-topic" value={data.search.id} onChange={event => { setData(null); setSelectedBucket(null); setSelectedId(event.target.value); }}>
              {data.topics.map(topic => <option key={topic.id} value={topic.id}>{topic.query} · {topic.platform === "x" ? "X" : "Bluesky"} · {topic.days === 1 ? "24 hours" : "7 days"}</option>)}
            </select>
          </label>
          <span>Latest check: {dateLabel(data.search.searched_at)}</span>
        </div>

        <TrackingChart key={data.search.id} snapshots={data.snapshots} topic={data.search.query} />

        <section className="trends-panel activity-panel" aria-labelledby="activity-heading">
          <div className="trends-heading"><div><p className="section-label">LATEST SEARCH</p><h2 id="activity-heading">When the posts appeared</h2></div><div className="trends-legend"><span><i className="mentions-key" /> Mentions</span><span><i className="engagement-key" /> Engagement</span></div></div>
          <p className="trend-help">{data.mentions.length} saved posts across {data.search.days === 1 ? "3-hour" : "daily"} intervals. Each line uses its own scale.</p>
          <div className="trend-chart" role="img" aria-label="Saved posts and engagement by publication time">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="5" y1="86" x2="95" y2="86" stroke="#47445b" strokeWidth=".3"/><line x1="5" y1="51" x2="95" y2="51" stroke="#343145" strokeWidth=".2"/><line x1="5" y1="16" x2="95" y2="16" stroke="#343145" strokeWidth=".2"/><polyline points={engagementLine} fill="none" stroke="#78e7df" strokeWidth="3" vectorEffect="non-scaling-stroke"/><polyline points={mentionsLine} fill="none" stroke="#9076ff" strokeWidth="4" vectorEffect="non-scaling-stroke"/></svg>
            <div className="trend-hit-targets">{buckets.map((bucket, index) => <button key={bucket.time} type="button" className={active === index ? "active" : ""} onClick={() => setSelectedBucket(index)} aria-label={`${dateLabel(bucket.time)}: ${bucket.mentions} mentions, ${bucket.engagement} engagement`}>{data.search?.days === 1 ? new Date(bucket.time).toLocaleTimeString("en", { hour: "numeric" }) : new Date(bucket.time).toLocaleDateString("en", { month: "short", day: "numeric" })}</button>)}</div>
          </div>
          <p className="trend-help">Select a point to see the posts in that interval.</p>
        </section>
        {buckets[active] && <section className="trend-details"><div className="trends-heading"><div><p className="section-label">POSTS IN THIS INTERVAL</p><h2>{dateLabel(buckets[active].time)}</h2></div><div className="trend-summary"><strong>{buckets[active].mentions}</strong> mentions <strong>{buckets[active].engagement}</strong> engagement</div></div>
          <div className="trend-post-toolbar"><label htmlFor="trend-post-sort">Sort posts</label><select id="trend-post-sort" value={postSort} onChange={event => setPostSort(event.target.value as PostSort)}><option value="latest">Latest</option><option value="top-engagement">Top engagement</option></select></div>
          <div className="trend-posts">{sortedPosts.length ? sortedPosts.map(post => <a key={post.id} href={post.post_url} target="_blank" rel="noreferrer" className="trend-post"><div><strong>{post.author}</strong><span>{dateLabel(post.published_at)}</span></div><p>{post.content}</p><small>♡ {post.likes} · ↻ {post.reposts} · ◯ {post.replies} · ❝ {post.quotes}</small></a>) : <p>No posts in this interval.</p>}</div>
        </section>}
      </>}
    </div>
  </main>;
}
