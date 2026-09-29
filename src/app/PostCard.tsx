"use client";

import { useState } from "react";
import Image from "next/image";
import { translationLanguages, type TranslationLanguage } from "@/lib/translation-languages";

type Post = {
  id: string; author: string; handle: string; avatar?: string; text: string;
  createdAt: string; likes: number; replies: number; reposts: number; quotes: number; url: string;
  sentiment?: "positive" | "neutral" | "negative";
};

const cachePrefix = "snowlax-translation-v1:";

function cacheKey(post: Post, language: TranslationLanguage) {
  // Include the original text so an edited post cannot reuse an old translation.
  let hash = 2166136261;
  for (const character of `${post.id}\0${post.text}\0${language}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${cachePrefix}${hash >>> 0}`;
}

function compact(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

export default function PostCard({ post }: { post: Post }) {
  const [language, setLanguage] = useState<TranslationLanguage>("en");
  const [translation, setTranslation] = useState("");
  const [translatedLanguage, setTranslatedLanguage] = useState<TranslationLanguage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function translate() {
    if (loading || !post.text.trim()) return;
    setError("");
    if (translatedLanguage === language && translation) {
      setTranslation("");
      setTranslatedLanguage(null);
      return;
    }
    const key = cacheKey(post, language);
    try {
      const cached = window.localStorage.getItem(key);
      if (cached) {
        setTranslation(cached);
        setTranslatedLanguage(language);
        return;
      }
    } catch { /* Translation still works when storage is unavailable. */ }

    setLoading(true);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: post.text, language }),
      });
      const data = await response.json() as { translation?: string; error?: string };
      if (!response.ok || !data.translation) throw new Error(data.error || "Could not translate this post.");
      setTranslation(data.translation);
      setTranslatedLanguage(language);
      try { window.localStorage.setItem(key, data.translation); }
      catch { /* Translation remains visible without local caching. */ }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not translate this post.");
    } finally { setLoading(false); }
  }

  return <article className="post-card">
    <div className="author-row">
      {post.avatar ? <Image src={post.avatar} alt="" width={38} height={38} unoptimized /> : <span className="avatar-fallback">{post.author[0]}</span>}
      <div><strong>{post.author}</strong><span>@{post.handle}</span></div>
      <time>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(post.createdAt))}</time>
    </div>
    <p className="post-original">{post.text}</p>
    {translation && translatedLanguage && <div className="post-translation">
      <strong>Translated to {translationLanguages[translatedLanguage]}</strong>
      <p>{translation}</p>
    </div>}
    <div className="post-actions">
      <div className="post-translate-control">
        <select aria-label={`Translate ${post.author}'s post to`} value={language} onChange={event => setLanguage(event.target.value as TranslationLanguage)}>
          {Object.entries(translationLanguages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        <button type="button" disabled={loading || !post.text.trim()} onClick={translate}>
          {loading ? "Translating…" : translatedLanguage === language && translation ? "Hide translation" : "Translate"}
        </button>
      </div>
      <a href={post.url} target="_blank" rel="noreferrer">View original ↗</a>
    </div>
    {error && <p className="post-translation-error" role="alert">{error}</p>}
    <span className={`sentiment-badge ${post.sentiment || "unanalysed"}`}>{post.sentiment || "Unanalysed"}</span>
    <div className="engagement"><span>♡ {compact(post.likes)}</span><span>↻ {compact(post.reposts)}</span><span>◯ {compact(post.replies)}</span><span>❝ {compact(post.quotes)}</span></div>
  </article>;
}
