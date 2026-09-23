"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type SearchPost = {
  id: string; author: string; handle: string; avatar?: string; text: string;
  createdAt: string; likes: number; replies: number; reposts: number; quotes: number; url: string;
};

const ranges = [
  { label: "24 hours", value: "1" }, { label: "7 days", value: "7" },
  { label: "30 days", value: "30" }, { label: "Any time", value: "all" },
];

function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

export default function Home() {
  const [query, setQuery] = useState("Snowlax");
  const [range, setRange] = useState("7");
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("snowlax-theme");
    if (savedTheme !== "light" && savedTheme !== "dark") return;
    const restoreTheme = window.setTimeout(() => setTheme(savedTheme), 0);
    return () => window.clearTimeout(restoreTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("snowlax-theme", nextTheme);
  }

  const totals = useMemo(() => posts.reduce(
    (acc, post) => ({ mentions: acc.mentions + 1, engagement: acc.engagement + post.likes + post.replies + post.reposts + post.quotes }),
    { mentions: 0, engagement: 0 },
  ), [posts]);

  async function search(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setSearched(term);
    setLoading(true);
    setError("");
    setPosts([]);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(term)}&days=${range}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed. Please try again.");
      setPosts(data.posts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`shell ${theme}`}>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Snowlax Dashboard home"><span className="brand-mark">S</span><span>SNOWLAX DASHBOARD</span></a>
        <div className="header-actions">
          <div className="day-pill"><span /> DAY 2 · LIVE SEARCH</div>
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            <span className="theme-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">SOCIAL LISTENING, WITHOUT THE SUBSCRIPTION</p>
        <h1>Find the conversations<br />that matter.</h1>
        <p className="lede">Search recent public conversations on Bluesky and see real posts and engagement.</p>
        <form className="search-panel" onSubmit={search}>
          <label className="search-box"><span className="icon">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a product, brand, or topic" aria-label="Search term" /></label>
          <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Date range">
            {ranges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button type="submit" disabled={loading}>{loading ? "Searching…" : "Search posts"}</button>
        </form>
        <p className="source-note"><span className="source-dot" /> Live public Bluesky results · up to 25 recent posts</p>
      </section>

      {searched && <section className="results-wrap" aria-live="polite">
        <div className="summary-row">
          <div><p className="section-label">{loading ? "SEARCHING" : "LIVE RESULTS"}</p><h2>{`“${searched}”`}</h2></div>
          <div className="metrics">
            <article><span>Mentions found</span><strong>{compact(totals.mentions)}</strong></article>
            <article><span>Total engagement</span><strong>{compact(totals.engagement)}</strong></article>
            <article className="coming"><span>Sentiment</span><strong>Coming soon</strong></article>
          </div>
        </div>
        {loading && <div className="message">Searching public posts…</div>}
        {error && <div className="message error" role="alert">{error}</div>}
        {!loading && !error && posts.length === 0 && <div className="message">No posts found. Try a broader search or a longer date range.</div>}
        <div className="post-grid">{posts.map((post) => (
          <article className="post-card" key={post.id}>
            <div className="author-row">
              <span className="avatar-fallback">{post.author[0]}</span>
              <div><strong>{post.author}</strong><span>@{post.handle}</span></div>
              <time dateTime={post.createdAt}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(post.createdAt))}</time>
            </div>
            <p>{post.text}</p>
            <div className="engagement"><span>♡ {compact(post.likes)}</span><span>↻ {compact(post.reposts)}</span><span>◯ {compact(post.replies)}</span><span>❝ {compact(post.quotes)}</span></div>
            <a className="post-link" href={post.url} target="_blank" rel="noopener noreferrer">View original post ↗</a>
          </article>
        ))}</div>
      </section>}
    </main>
  );
}
