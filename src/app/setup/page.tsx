import Link from "next/link";

const tools = [
  { name: "Platform APIs", purpose: "Search public posts and collect engagement data", services: "Bluesky, Reddit, X, LinkedIn", timing: "Days 1–2" },
  { name: "Supabase Postgres", purpose: "Save searches, mentions, engagement, and trend history", services: "Database", timing: "Day 3" },
  { name: "OpenAI API", purpose: "Classify sentiment and summarize conversations", services: "AI analysis", timing: "Day 4" },
  { name: "Next.js", purpose: "Build the dashboard interface and server routes", services: "Application", timing: "Ready" },
];

export default function SetupPage() {
  return (
    <main className="simple-setup">
      <header className="simple-header">
        <Link className="brand" href="/"><span className="brand-mark">S</span><span>SNOWLAX DASHBOARD</span></Link>
        <span>DAY 1</span>
      </header>
      <section className="simple-content">
        <p className="simple-eyebrow">PROJECT REQUIREMENTS</p>
        <h1>What we need for<br />the dashboard</h1>
        <p className="simple-intro">Four building blocks are needed to collect, store, and understand online mentions.</p>
        <div className="simple-list">
          {tools.map((tool, index) => (
            <article key={tool.name}>
              <span className="simple-number">0{index + 1}</span>
              <div className="simple-tool"><h2>{tool.name}</h2><span>{tool.services}</span></div>
              <p>{tool.purpose}</p>
              <strong>{tool.timing}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
