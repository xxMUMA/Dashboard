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

  function search(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    const createdAt = new Date().toISOString();
    setPosts([
      { id: "preview-1", author: "Sample Creator", handle: "sample.creator", text: `Trying ${term} today. Looking forward to seeing how it works.`, createdAt, likes: 24, replies: 3, reposts: 2, quotes: 0, url: "" },
      { id: "preview-2", author: "Sample User", handle: "sample.user", text: `Has anyone else heard about ${term}? I would like to know more.`, createdAt, likes: 11, replies: 5, reposts: 1, quotes: 0, url: "" },
    ]);
    setSearched(term);
  }

  return (
    <main className={`shell ${theme}`}>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Snowlax Dashboard home"><span className="brand-mark">S</span><span>SNOWLAX DASHBOARD</span></a>
        <div className="header-actions">
          <div className="day-pill"><span /> DAY 1 · PLATFORM SEARCH</div>
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            <span className="theme-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">SOCIAL LISTENING, WITHOUT THE SUBSCRIPTION</p>
        <h1>Find the conversations<br />that matter.</h1>
        <p className="lede">Preview the search interface and see how public mentions will appear once live data is connected.</p>
        <form className="search-panel" onSubmit={search}>
          <label className="search-box"><span className="icon">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a product, brand, or topic" aria-label="Search term" /></label>
          <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Date range">
            {ranges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button type="submit">Preview results</button>
        </form>
        <p className="source-note"><span className="source-dot" /> Fictional sample posts · live search arrives on Day 2</p>
      </section>

      {searched && <section className="results-wrap" aria-live="polite">
        <div className="summary-row">
          <div><p className="section-label">SAMPLE RESULTS</p><h2>{`“${searched}”`}</h2></div>
          <div className="metrics">
            <article><span>Mentions found</span><strong>{compact(totals.mentions)}</strong></article>
            <article><span>Total engagement</span><strong>{compact(totals.engagement)}</strong></article>
            <article className="coming"><span>Sentiment</span><strong>Coming soon</strong></article>
          </div>
        </div>
        <div className="post-grid">{posts.map((post) => (
          <article className="post-card" key={post.id}>
            <div className="author-row">
              <span className="avatar-fallback">{post.author[0]}</span>
              <div><strong>{post.author}</strong><span>@{post.handle}</span></div>
              <time>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(post.createdAt))}</time>
            </div>
            <p>{post.text}</p>
            <div className="engagement"><span>♡ {compact(post.likes)}</span><span>↻ {compact(post.reposts)}</span><span>◯ {compact(post.replies)}</span><span>❝ {compact(post.quotes)}</span></div>
          </article>
        ))}</div>
      </section>}
    </main>
  );
}
