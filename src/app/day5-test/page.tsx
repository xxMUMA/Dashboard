"use client";
import { useState } from "react";

const post = "The iPhone 18 Pro and Pro Max are now available to pre-order and we have found a deal to get a new case for as little as £9.72 with TopCashback (Contains affiliate links)";
type Result = { sentiment: string; model: string; confidence?: number };
export default function Day5Test() {
  const [gpt, setGpt] = useState<Result | null>(null);
  const [jev, setJev] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function compare() {
    setBusy(true); setError(""); setGpt(null); setJev(null);
    try {
      const [gptResponse, jevResponse] = await Promise.all([
        fetch("/api/sentiment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "iPhone 18", posts: [{ id: "archived-day4-promo", text: post }] }) }),
        fetch("/api/jev-sentiment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "iPhone 18", text: post }) }),
      ]);
      const gptData = await gptResponse.json(); const jevData = await jevResponse.json();
      if (!gptResponse.ok || !jevResponse.ok) throw new Error(gptData.error || jevData.error || "Comparison failed.");
      setGpt({ sentiment: gptData.results[0].sentiment, model: gptData.model });
      setJev(jevData);
    } catch (e) { setError(e instanceof Error ? e.message : "Comparison failed."); }
    finally { setBusy(false); }
  }
  return <main className="day5-test"><div className="day5-test-inner"><p className="section-label">DAY 5 · SAME POST, TWO MODELS</p><h1>Does the label<br />fit the context?</h1><p className="day5-test-intro">A real promotional post saved from Day 4. We classify the same text with GPT and Jev, then compare both labels with the original wording.</p>
    <div className="day5-original"><span>ORIGINAL POST · ARCHIVED DAY 4</span><strong>nottinghampost.co.uk</strong><p>{post}</p></div>
    <button className="day5-run" type="button" disabled={busy} onClick={compare}>{busy ? "Testing both models…" : "Run side-by-side test"}</button>
    {error && <p className="message error">{error}</p>}
    <div className="day5-comparison"><article><span>GPT ANALYSIS</span><strong>{gpt ? gpt.sentiment : "Awaiting test"}</strong><small>{gpt?.model || "—"}</small></article><article><span>JEV ANALYSIS</span><strong>{jev ? jev.sentiment : "Awaiting test"}</strong><small>{jev?.model || "—"}</small></article></div>
    <p className="day5-caveat">One result is a starting point. I still need more manually reviewed posts before deciding whether to change the model.</p><a className="day5-trend-link" href="/trends">View saved-post trends ↗</a>
  </div></main>;
}
