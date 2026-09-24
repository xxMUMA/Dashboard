"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import DashboardSidebar from "./DashboardSidebar";
import { modelInfo, sentimentModels, type SentimentModel } from "@/lib/sentiment-models";
import { platformName, platformRegistry, type Platform, type SearchablePlatform } from "@/lib/platforms";

type Sentiment = "positive" | "neutral" | "negative";

type SearchPost = {
  id: string; author: string; handle: string; avatar?: string; text: string;
  createdAt: string; likes: number; replies: number; reposts: number; quotes: number; url: string;
  platform?: Platform;
  sentiment?: Sentiment;
};

type SearchResponse = { posts: SearchPost[]; query: string; fetchedAt: string; fetchedCount?: number; saved?: boolean; error?: string };
type InsightEvidence = { id: string; platform: string; url: string; text: string };
type InsightFinding = { title: string; explanation: string; evidence: InsightEvidence[] };
type Insights = { overview: string; praise: InsightFinding[]; complaints: InsightFinding[]; themes: InsightFinding[]; analysedPosts: number; model: string };
type HistoryItem = {
  id: string;
  query: string;
  platform: SearchablePlatform;
  days: number;
  mentions_count: number;
  total_engagement: number;
  searched_at: string;
};

const ranges = [
  { label: "24 hours", value: "1" }, { label: "7 days", value: "7" },
];
const dashboardSessionKey = "snowlax-dashboard-view-v1";
const insightSections = [
  { key: "praise", title: "What people like", empty: "No clear praise in these posts." },
  { key: "complaints", title: "What people complain about", empty: "No clear complaints in these posts." },
  { key: "themes", title: "Main topics", empty: "No clear recurring topics found." },
] as const;

type DashboardView = {
  query: string;
  range: string;
  mentionLimit: string;
  mustInclude: string;
  exclude: string;
  platforms: SearchablePlatform[];
  posts: SearchPost[];
  searched: string;
  searchWarning: string;
  fetchedCount: number;
  appliedRules: number;
  savedAt: string | null;
  aiModel: SentimentModel;
  analysedWith: SentimentModel | null;
  filter: Sentiment | "all" | "unanalysed";
  insights: Insights | null;
};

function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

export default function Home() {
  const [query, setQuery] = useState("iPhone 18");
  const [range, setRange] = useState("7");
  const [mentionLimit, setMentionLimit] = useState("25");
  const [mustInclude, setMustInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [platforms, setPlatforms] = useState<SearchablePlatform[]>(["bluesky"]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchWarning, setSearchWarning] = useState("");
  const [fetchedCount, setFetchedCount] = useState(0);
  const [appliedRules, setAppliedRules] = useState(0);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [aiModel, setAiModel] = useState<SentimentModel>("gpt-6-luna");
  const [analysedWith, setAnalysedWith] = useState<SentimentModel | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [filter, setFilter] = useState<Sentiment | "all" | "unanalysed">("all");
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const busy = loading || analysing || clearing || insightsLoading;
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0, unanalysed: 0 };
  for (const post of posts) sentimentCounts[post.sentiment || "unanalysed"]++;
  const visiblePosts = posts.filter(p => filter === "all" || (p.sentiment || "unanalysed") === filter);
  const postGroups = platformRegistry
    .filter(source => posts.some(post => post.platform === source.id))
    .map(source => ({ ...source, key: source.id, posts: posts.filter(post => post.platform === source.id) }));
  const selectedModel = modelInfo(aiModel)!;
  const activeRules = [mustInclude, exclude].reduce((total, value) => total + value.split(",").filter(term => term.trim()).length, 0);

  async function analyse() {
    if (!posts.length || busy) return;
    const remaining = analysedWith === aiModel ? posts.filter(post => !post.sentiment) : posts;
    if (analysedWith !== aiModel) {
      setPosts(current => current.map(post => ({ ...post, sentiment: undefined })));
      setAnalysedWith(null);
    }
    setFilter("all");
    setAnalysing(true); setAnalysisError("");
    try {
      const endpoint = selectedModel.provider === "openai" ? "/api/sentiment" : selectedModel.provider === "gemini" ? "/api/gemini-sentiment" : selectedModel.provider === "deepseek" ? "/api/deepseek-sentiment" : "/api/jev-sentiment/batch";
      const batchSize = selectedModel.provider === "openai" ? 10 : 25;
      for (let offset = 0; offset < remaining.length; offset += batchSize) {
        const batch = remaining.slice(offset, offset + batchSize);
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: searched, model: aiModel, posts: batch.map(p => ({ id: p.id, text: p.text })) }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Analysis failed");
        const labels = new Map((data.results as { id: string; sentiment: Sentiment }[]).map(result => [result.id, result.sentiment]));
        setPosts(current => current.map(post => labels.has(post.id) ? { ...post, sentiment: labels.get(post.id) } : post));
        setAnalysedWith(aiModel);
      }
    } catch (e) { setAnalysisError(e instanceof Error ? e.message : "Analysis failed"); }
    finally { setAnalysing(false); }
  }

  async function generateInsights() {
    if (!posts.length || busy) return;
    setInsightsLoading(true); setInsightsError("");
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searched, posts: posts.map(post => ({ id: post.id, text: post.text.slice(0, 2000), platform: post.platform || "unknown", url: post.url })) }),
      });
      const data = await response.json() as Insights & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not summarise these posts.");
      setInsights(data);
    } catch (caught) {
      setInsightsError(caught instanceof Error ? caught.message : "Could not summarise these posts.");
    } finally { setInsightsLoading(false); }
  }

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/history", { cache: "no-store" });
      const data = (await response.json()) as { history?: HistoryItem[] };
      setHistory(data.history || []);
      setHistoryReady(response.ok);
    } catch {
      setHistoryReady(false);
    }
  }, []);

  async function clearHistory() {
    if (!confirmClear || busy) return;
    setClearing(true); setHistoryMessage("");
    try {
      const response = await fetch("/api/history", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "clear-saved-searches" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not clear saved searches.");
      setHistory([]);
      setConfirmClear(false);
      setHistoryMessage(`Cleared ${data.deleted} saved searches and their linked mentions.`);
      await loadHistory();
    } catch (e) { setHistoryMessage(e instanceof Error ? e.message : "Could not clear saved searches."); }
    finally { setClearing(false); }
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("snowlax-theme");
    if (savedTheme !== "light" && savedTheme !== "dark") return;
    const restoreTheme = window.setTimeout(() => setTheme(savedTheme), 0);
    return () => window.clearTimeout(restoreTheme);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadHistory(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(dashboardSessionKey);
        if (raw) {
          const view = JSON.parse(raw) as Partial<DashboardView>;
          if (typeof view.query === "string") setQuery(view.query);
          if (ranges.some(item => item.value === view.range)) setRange(view.range!);
          if (["10", "25", "50", "100"].includes(view.mentionLimit || "")) setMentionLimit(view.mentionLimit!);
          if (typeof view.mustInclude === "string") setMustInclude(view.mustInclude);
          if (typeof view.exclude === "string") setExclude(view.exclude);
          if (Array.isArray(view.platforms)) {
            const available = view.platforms.filter((id): id is SearchablePlatform => platformRegistry.some(item => item.id === id && item.searchable));
            if (available.length > 0) setPlatforms(available);
          }
          if (Array.isArray(view.posts)) setPosts(view.posts.filter(post => typeof post?.id === "string" && typeof post?.text === "string" && typeof post?.url === "string"));
          if (typeof view.searched === "string") setSearched(view.searched);
          if (typeof view.searchWarning === "string") setSearchWarning(view.searchWarning);
          if (typeof view.fetchedCount === "number") setFetchedCount(view.fetchedCount);
          if (typeof view.appliedRules === "number") setAppliedRules(view.appliedRules);
          if (typeof view.savedAt === "string" || view.savedAt === null) setSavedAt(view.savedAt);
          if (view.aiModel && modelInfo(view.aiModel)) setAiModel(view.aiModel);
          if (view.analysedWith && modelInfo(view.analysedWith)) setAnalysedWith(view.analysedWith);
          if (["all", "positive", "neutral", "negative", "unanalysed"].includes(view.filter || "")) setFilter(view.filter!);
          if (view.insights && typeof view.insights.overview === "string" && Array.isArray(view.insights.praise) && Array.isArray(view.insights.complaints) && Array.isArray(view.insights.themes)) setInsights(view.insights);
        }
      } catch {
        // An old or unavailable session should not prevent a new search.
      } finally {
        setSessionReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    const view: DashboardView = { query, range, mentionLimit, mustInclude, exclude, platforms, posts, searched, searchWarning, fetchedCount, appliedRules, savedAt, aiModel, analysedWith, filter, insights };
    try { window.sessionStorage.setItem(dashboardSessionKey, JSON.stringify(view)); }
    catch { /* The dashboard still works if browser storage is unavailable. */ }
  }, [sessionReady, query, range, mentionLimit, mustInclude, exclude, platforms, posts, searched, searchWarning, fetchedCount, appliedRules, savedAt, aiModel, analysedWith, filter, insights]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("snowlax-theme", nextTheme);
  }

  function togglePlatform(nextPlatform: SearchablePlatform) {
    setPlatforms(current => current.includes(nextPlatform) ? current.length > 1 ? current.filter(value => value !== nextPlatform) : current : [...current, nextPlatform]);
    setPosts([]);
    setSearched("");
    setError("");
    setSearchWarning("");
    setInsights(null); setInsightsError("");
    setAnalysisError(""); setFilter("all"); setAnalysedWith(null);
  }

  const totals = useMemo(() => posts.reduce(
    (acc, post) => ({ mentions: acc.mentions + 1, engagement: acc.engagement + post.likes + post.replies + post.reposts + post.quotes }),
    { mentions: 0, engagement: 0 },
  ), [posts]);

  async function runSearch(term: string, nextRange = range, nextPlatforms = platforms) {
    if (!term || busy) return;
    setLoading(true); setError(""); setSearchWarning(""); setPosts([]); setSearched(""); setAnalysisError(""); setFilter("all"); setAnalysedWith(null); setSavedAt(null); setFetchedCount(0); setInsights(null); setInsightsError("");
    try {
      const results = await Promise.all(nextPlatforms.map(async (source) => {
        try {
          const response = await fetch(`/api/search?q=${encodeURIComponent(term)}&days=${nextRange}&platform=${source}&limit=${mentionLimit}&include=${encodeURIComponent(mustInclude)}&exclude=${encodeURIComponent(exclude)}`);
          const data = (await response.json()) as SearchResponse;
          if (!response.ok) throw new Error(data.error || "Search failed");
          return { source, data };
        } catch (caught) {
          return { source, error: caught instanceof Error ? caught.message : "Search failed" };
        }
      }));
      const successes = results.filter((result): result is { source: SearchablePlatform; data: SearchResponse } => "data" in result && !!result.data);
      const failures = results.filter((result): result is { source: SearchablePlatform; error: string } => "error" in result && !!result.error);
      if (successes.length === 0) throw new Error(failures.map(result => `${platformName(result.source)}: ${result.error}`).join(" "));
      const combined = successes.flatMap(({ source, data }) => data.posts.map(post => ({ ...post, platform: source })));
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPosts(combined); setSearched(term);
      setFetchedCount(successes.reduce((total, result) => total + (result.data.fetchedCount ?? result.data.posts.length), 0)); setAppliedRules(activeRules);
      if (failures.length) setSearchWarning(failures.map(result => `${platformName(result.source)}: ${result.error}`).join(" "));
      if (successes.some(result => result.data.saved)) await loadHistory();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed");
    } finally { setLoading(false); }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    await runSearch(query.trim());
  }

  async function revisitSearch(item: HistoryItem) {
    setLoading(true); setError(""); setSearchWarning(""); setPosts([]); setSearched(""); setAnalysisError(""); setFilter("all"); setAnalysedWith(null); setInsights(null); setInsightsError("");
    try {
      const response = await fetch(`/api/history?id=${encodeURIComponent(item.id)}`, { cache: "no-store" });
      const data = (await response.json()) as { posts?: SearchPost[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not open saved search.");
      const savedPosts = data.posts || [];
      setQuery(item.query); setRange(String(item.days)); setPlatforms([item.platform]);
      setMustInclude(""); setExclude("");
      setPosts(savedPosts); setSearched(item.query); setFetchedCount(savedPosts.length); setSavedAt(item.searched_at); setAppliedRules(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open saved search.");
    } finally { setLoading(false); }
  }

  return (
    <main className={`shell ${theme}`}>
      <DashboardSidebar />
      <header className="topbar">
        <span className="topbar-section">Search dashboard</span>
        <div className="header-actions">
          <div className="day-pill"><span /> DAY 6 · CHOOSE YOUR AI</div>
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            <span className="theme-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">SOCIAL LISTENING, WITHOUT THE SUBSCRIPTION</p>
        <h1>Find the conversations<br />that matter.</h1>
        <p className="lede">Search public posts, save every result, and revisit how the conversation changes over time.</p>
        <form id="search-form" className="search-panel" onSubmit={search}>
          <label className="search-box"><span className="icon">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a product, brand, or topic" aria-label="Search term" /></label>
          <button disabled={busy} type="submit">{loading ? "Searching…" : "Search mentions"}</button>
        </form>
        <details className="search-options">
          <summary><span>Search options</span><span className="search-options-summary">{platforms.map(platformName).join(" + ")} · {ranges.find(item => item.value === range)?.label} · {mentionLimit} posts{activeRules > 0 ? ` · ${activeRules} keyword ${activeRules === 1 ? "rule" : "rules"}` : ""}</span></summary>
          <div className="search-options-body">
            <fieldset className="platform-picker" disabled={busy}>
              <legend>Platforms</legend>
              {platformRegistry.map(source => source.searchable
                ? <label key={source.id}><input type="checkbox" checked={platforms.includes(source.id)} onChange={() => togglePlatform(source.id)} disabled={busy || (platforms.length === 1 && platforms.includes(source.id))} /> {source.label}</label>
                : <label className="platform-placeholder" key={source.id}><input type="checkbox" disabled /> {source.label}</label>)}
            </fieldset>
            <div className="search-option-selects">
              <label>Date range<select form="search-form" value={range} disabled={busy} onChange={(event) => setRange(event.target.value)}>
                {ranges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select></label>
              <label>Posts per platform<select form="search-form" value={mentionLimit} disabled={busy} onChange={(event) => setMentionLimit(event.target.value)}>
                {[10, 25, 50, 100].map(value => <option key={value} value={value}>{value} posts</option>)}
              </select></label>
            </div>
            <div className="search-filter-fields">
              <label>Must include <input form="search-form" value={mustInclude} onChange={event => setMustInclude(event.target.value)} disabled={busy} maxLength={300} placeholder="e.g. iPhone, camera" /></label>
              <label>Exclude <input form="search-form" value={exclude} onChange={event => setExclude(event.target.value)} disabled={busy} maxLength={300} placeholder="e.g. recipe, pie" /></label>
            </div>
            <p>Separate keyword phrases with commas. Filters narrow the posts found on each platform.</p>
          </div>
        </details>
      </section>

      {(historyReady || history.length > 0) && <details className="history-wrap" aria-label="Recent search history">
        <summary className="history-heading"><span>Recent searches</span><span>{history.length} saved</span></summary>
        <div className="history-content">
        <div className="history-actions"><button type="button" className="clear-history" disabled={busy || history.length === 0} onClick={() => { setConfirmClear(true); setHistoryMessage(""); }}>{clearing ? "Clearing…" : "Clear saved searches"}</button></div>
        {confirmClear && <div className="clear-confirmation" role="group" aria-label="Confirm clearing saved searches">
          <p>Delete all saved searches and their linked mentions, including older searches not shown here? This cannot be undone.</p>
          <div className="history-actions">
            <button className="clear-history" type="button" disabled={busy} onClick={clearHistory}>{clearing ? "Deleting…" : "Yes, delete saved data"}</button>
            <button className="clear-history" type="button" disabled={clearing} onClick={() => setConfirmClear(false)}>Cancel</button>
          </div>
        </div>}
        {historyMessage && <p role="status" className="source-note">{historyMessage}</p>}
        {history.length === 0 ? <p className="history-empty">Your completed searches will appear here.</p> :
          <div className="history-list">{history.map((item) => (
            <button className="history-card" type="button" key={item.id} onClick={() => { void revisitSearch(item); }} disabled={busy}>
              <span className="history-platform">{item.platform}</span>
              <strong>{item.query}</strong>
              <span>{item.mentions_count} mentions · {compact(item.total_engagement)} engagement</span>
              <time>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.searched_at))}</time>
            </button>
          ))}</div>}
        </div>
      </details>}

      {(searched || loading || error) && <section className="results-wrap" aria-live="polite">
        <div className="summary-row">
          <div><p className="section-label">SEARCH OVERVIEW</p><h2>{searched ? `“${searched}”` : loading ? "Searching…" : "Search failed"}</h2>{searched && <p className="source-note">{savedAt ? `Saved results from ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(savedAt))}` : `${platforms.map(source => `${platformName(source)}: ${posts.filter(post => post.platform === source).length}`).join(" · ")} mentions${appliedRules ? ` · ${posts.length} of ${fetchedCount} fetched posts matched filters` : ""}`}</p>}</div>
          <div className="metrics">
            <article><span>Mentions found</span><strong>{compact(totals.mentions)}</strong></article>
            <article><span>Total engagement</span><strong>{compact(totals.engagement)}</strong></article>
            <article><span>{analysedWith ? `Analysed by ${modelInfo(analysedWith)?.label}` : "Analysed posts"}</span><strong>{posts.length - sentimentCounts.unanalysed} / {posts.length}</strong></article>
          </div>
        </div>
        {error && <div className="message error">{error}</div>}
        {searchWarning && <div className="message error" role="alert">Some platforms could not be searched. Showing available results. {searchWarning}</div>}
        {posts.length > 0 && <section className="sentiment-panel" aria-label="Sentiment analysis">
          <div className="analysis-controls">
            <label htmlFor="ai-model">AI model
              <select id="ai-model" value={aiModel} disabled={busy} onChange={event => { setAiModel(event.target.value as SentimentModel); setAnalysisError(""); }}>
                {sentimentModels.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
              </select>
            </label>
            <button className="analyse-button" type="button" disabled={busy || (analysedWith === aiModel && sentimentCounts.unanalysed === 0)} onClick={analyse}>{analysing ? `Analysing with ${selectedModel.label}…` : `Analyse with ${selectedModel.label}`}</button>
          </div>
          <p className="source-note">Only the selected model runs. {analysedWith && analysedWith !== aiModel ? `Current labels are from ${modelInfo(analysedWith)?.label}; analyse again to replace them.` : "Review AI labels in context. Labels are kept for this session."}</p>
          {analysisError && <p className="message error" role="alert">{analysisError}</p>}
          <div className="sentiment-filters">{(["all", "positive", "neutral", "negative", "unanalysed"] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value} · {value === "all" ? posts.length : sentimentCounts[value]}</button>)}</div>
          <p className="source-note">Showing {visiblePosts.length} of {posts.length} mentions</p>
        </section>}
        {posts.length > 0 && <section className="insights-panel" aria-label="AI conversation insights">
          <div className="insights-heading">
            <div><p className="section-label">AI INSIGHTS</p><h3>What are people saying?</h3><p>Summarise the posts in this search to find praise, complaints, and main topics.</p></div>
            <button type="button" disabled={busy} onClick={generateInsights}>{insightsLoading ? "Reading posts…" : insights ? "Refresh summary" : "Summarise with GPT"}</button>
          </div>
          {insightsError && <p className="message error" role="alert">{insightsError}</p>}
          {insights && <>
            <p className="insights-overview">{insights.overview}</p>
            <p className="insights-scope">Based on {insights.analysedPosts} collected posts in this search. This is an AI summary of the sample, not a platform-wide trend.</p>
            <div className="insights-grid">{insightSections.map(section => <div className="insights-category" key={section.key}>
              <h4>{section.title}</h4>
              {insights[section.key].length === 0 ? <p className="insights-empty">{section.empty}</p> : insights[section.key].map((finding, index) => <article className="insight-finding" key={`${section.key}-${index}`}>
                <strong>{finding.title}</strong><p>{finding.explanation}</p>
                <div className="insight-evidence">{finding.evidence.map((post, postIndex) => <a href={post.url} target="_blank" rel="noreferrer" key={`${post.platform}-${post.id}`} title={post.text}>{post.platform} post {postIndex + 1} ↗</a>)}</div>
              </article>)}
            </div>)}</div>
          </>}
        </section>}
        {!error && !loading && posts.length === 0 && <div className="message">{savedAt ? "This saved search has no mentions." : appliedRules ? "No fetched posts matched these filters. Try broader rules or a higher post limit." : "No public posts found on the selected platforms. Try a broader search or a longer date range."}</div>}
        {postGroups.length > 0 && <nav className="platform-dock-wrap" aria-label="Jump to platform posts">
          <span className="platform-dock-caption">Jump to posts</span>
          <div className="platform-dock">
            {postGroups.map(group => <a className="platform-dock-item" style={{ background: group.background }} key={group.key} href={`#platform-${group.key}`} aria-label={`Jump to ${group.label} posts`} data-label={group.label}>
              <span className="platform-dock-icon" aria-hidden="true">{group.icon}</span>
              <span className="platform-dock-dot" aria-hidden="true" />
            </a>)}
          </div>
        </nav>}
        {postGroups.map(group => {
          const groupVisible = group.posts.filter(post => filter === "all" || (post.sentiment || "unanalysed") === filter);
          return <section id={`platform-${group.key}`} className="platform-results" aria-label={`${group.label} results`} key={group.key}>
            <div className="platform-results-header">
              <h3>{group.label}</h3>
              <span>{groupVisible.length === group.posts.length ? `${group.posts.length} mentions` : `${groupVisible.length} of ${group.posts.length} shown`}</span>
            </div>
            {groupVisible.length === 0 ? <p className="platform-results-empty">No {filter} mentions from {group.label}.</p> :
              <div className="post-grid">{groupVisible.map(post => (
                <a className="post-card" href={post.url} target="_blank" rel="noreferrer" key={post.id}>
                  <div className="author-row">
                    {post.avatar ? <Image src={post.avatar} alt="" width={38} height={38} unoptimized /> : <span className="avatar-fallback">{post.author[0]}</span>}
                    <div><strong>{post.author}</strong><span>@{post.handle}</span></div>
                    <time>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(post.createdAt))}</time>
                  </div>
                  <p>{post.text}</p>
                  <span className={`sentiment-badge ${post.sentiment || "unanalysed"}`}>{post.sentiment || "Unanalysed"}</span>
                  <div className="engagement"><span>♡ {compact(post.likes)}</span><span>↻ {compact(post.reposts)}</span><span>◯ {compact(post.replies)}</span><span>❝ {compact(post.quotes)}</span></div>
                </a>
              ))}</div>}
          </section>;
        })}
      </section>}
    </main>
  );
}
