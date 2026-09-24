"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";

type Snapshot = { id: string; searched_at: string; mentions_count: number; total_engagement: number };
type Range = "24h" | "7d" | "30d" | "all" | "custom";
type Metric = "mentions" | "engagement";
type Point = { x: number; y: number };

const rangeOptions: { value: Range; label: string }[] = [
  { value: "24h", label: "24H" }, { value: "7d", label: "7D" },
  { value: "30d", label: "30D" }, { value: "all", label: "ALL" },
  { value: "custom", label: "CUSTOM" },
];
const compact = (value: number) => new Intl.NumberFormat("en", { notation: "compact" }).format(value);
const dateLabel = (value: string) => new Date(value).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function localDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function amount(snapshot: Snapshot, metric: Metric) {
  return metric === "mentions" ? snapshot.mentions_count : snapshot.total_engagement;
}

export default function TrackingChart({ snapshots, topic }: { snapshots: Snapshot[]; topic: string }) {
  const [range, setRange] = useState<Range>("all");
  const [metric, setMetric] = useState<Metric>("mentions");
  const [from, setFrom] = useState(() => localDateTime(snapshots[0].searched_at));
  const [to, setTo] = useState(() => localDateTime(snapshots[snapshots.length - 1].searched_at));
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState(snapshots[snapshots.length - 1].id);

  const customStart = new Date(from).getTime();
  const customEnd = new Date(to).getTime();
  const invalidCustom = range === "custom" && (!Number.isFinite(customStart) || !Number.isFinite(customEnd) || customStart > customEnd);
  const visible = useMemo(() => {
    const latest = new Date(snapshots[snapshots.length - 1].searched_at).getTime();
    const period = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : null;
    const start = range === "custom" ? customStart : period === null ? -Infinity : latest - period * 86_400_000;
    const end = range === "custom" ? customEnd + 59_999 : Infinity;
    if (invalidCustom) return [];
    return snapshots.filter(snapshot => {
      const time = new Date(snapshot.searched_at).getTime();
      return time >= start && time <= end;
    });
  }, [snapshots, range, customStart, customEnd, invalidCustom]);

  const maxValue = Math.max(1, ...visible.map(snapshot => amount(snapshot, metric)));
  const points = useMemo<Point[]>(() => {
    if (!visible.length) return [];
    const first = new Date(visible[0].searched_at).getTime();
    const last = new Date(visible[visible.length - 1].searched_at).getTime();
    const span = Math.max(1, last - first);
    return visible.map(snapshot => ({
      x: visible.length === 1 ? 500 : 60 + (new Date(snapshot.searched_at).getTime() - first) * 880 / span,
      y: 210 - amount(snapshot, metric) * 160 / maxValue,
    }));
  }, [visible, metric, maxValue]);

  const selectedIndex = visible.findIndex(snapshot => snapshot.id === selectedId);
  const activeIndex = hoveredIndex ?? (selectedIndex >= 0 ? selectedIndex : visible.length - 1);
  const active = visible[activeIndex];
  const activePoint = points[activeIndex];
  const current = visible[visible.length - 1];
  const previous = visible[visible.length - 2];
  const delta = previous ? amount(current, metric) - amount(previous, metric) : null;
  const line = points.map(point => `${point.x},${point.y}`).join(" ");
  const area = points.length > 1 ? `M ${points[0].x} 210 L ${points.map(point => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1].x} 210 Z` : "";

  function nearestPoint(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * 1000;
    return points.reduce((best, point, index) => Math.abs(point.x - x) < Math.abs(points[best].x - x) ? index : best, 0);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!visible.length) return;
    const currentIndex = selectedIndex >= 0 ? selectedIndex : visible.length - 1;
    const nextIndex = event.key === "ArrowLeft" ? Math.max(0, currentIndex - 1) : event.key === "ArrowRight" ? Math.min(visible.length - 1, currentIndex + 1) : event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    setHoveredIndex(null);
    setSelectedId(visible[nextIndex].id);
  }

  return <section className="trends-panel stock-panel" aria-labelledby="tracking-heading">
    <div className="stock-heading"><div><p className="section-label">ACROSS SAVED SEARCHES</p><h2 id="tracking-heading">{topic} over time</h2><p className="trend-help">{snapshots.length} saved {snapshots.length === 1 ? "check" : "checks"} for this topic, platform and search window.</p></div>
      <div className="stock-metric-switch" aria-label="Chart metric"><button type="button" aria-pressed={metric === "mentions"} onClick={() => { setMetric("mentions"); setHoveredIndex(null); }}>Mentions</button><button type="button" aria-pressed={metric === "engagement"} onClick={() => { setMetric("engagement"); setHoveredIndex(null); }}>Engagement</button></div>
    </div>
    <div className="stock-summary"><strong>{current ? compact(amount(current, metric)) : "—"}</strong><span>{metric === "mentions" ? "sampled mentions" : "total engagement"}</span>{delta !== null && <em className={delta >= 0 ? "up" : "down"}>{delta >= 0 ? "+" : ""}{compact(delta)} since previous check</em>}</div>
    <div className="stock-range" aria-label="Chart time range">{rangeOptions.map(option => <button key={option.value} type="button" aria-pressed={range === option.value} onClick={() => { setRange(option.value); setHoveredIndex(null); }}>{option.label}</button>)}</div>
    {range === "custom" && <div className="stock-custom-range"><label>From <input type="datetime-local" value={from} onChange={event => setFrom(event.target.value)} /></label><label>To <input type="datetime-local" value={to} onChange={event => setTo(event.target.value)} /></label></div>}
    {invalidCustom && <p className="message error">Choose a start date and time before the end date and time.</p>}
    {!invalidCustom && visible.length === 0 && <p className="stock-empty">No saved checks in this time range. Try a wider range.</p>}
    {visible.length > 0 && <>
      <div className="stock-chart" role="slider" tabIndex={0} aria-label={`${topic} ${metric} by saved search time. Use arrow keys to select a check.`} aria-valuemin={1} aria-valuemax={visible.length} aria-valuenow={activeIndex + 1} aria-valuetext={`${dateLabel(active.searched_at)}: ${amount(active, metric)} ${metric}`} onPointerMove={event => setHoveredIndex(nearestPoint(event))} onPointerLeave={() => setHoveredIndex(null)} onPointerDown={event => { const index = nearestPoint(event); setSelectedId(visible[index].id); setHoveredIndex(index); }} onKeyDown={handleKeyDown}>
        <div className="stock-axis"><span>{compact(maxValue)}</span><span>{compact(Math.round(maxValue / 2))}</span><span>0</span></div>
        <svg viewBox="0 0 1000 260" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="stock-area-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#9076ff" stopOpacity=".36" /><stop offset="100%" stopColor="#9076ff" stopOpacity="0" /></linearGradient></defs>
          {[50, 130, 210].map(y => <line key={y} x1="60" y1={y} x2="940" y2={y} stroke="#343145" strokeWidth="1" />)}
          {area && <path d={area} fill="url(#stock-area-gradient)" />}
          {points.length > 1 && <polyline points={line} fill="none" stroke="#a895ff" strokeWidth="4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
          {points.map((point, index) => <circle key={visible[index].id} cx={point.x} cy={point.y} r={index === activeIndex ? 7 : 4} fill={index === activeIndex ? "#e9e0ff" : "#a895ff"} stroke="#51419a" strokeWidth="2" />)}
          {activePoint && <line x1={activePoint.x} y1="30" x2={activePoint.x} y2="210" stroke="#bfb0ff" strokeWidth="1.5" strokeDasharray="5 5" />}
        </svg>
        {activePoint && <div className="stock-tooltip" style={{ left: `${Math.min(82, Math.max(18, activePoint.x / 10))}%` }}><strong>{dateLabel(active.searched_at)}</strong><span>{active.mentions_count} mentions · {compact(active.total_engagement)} engagement</span></div>}
      </div>
      <div className="tracking-period"><span>{dateLabel(visible[0].searched_at)}</span><span>{dateLabel(visible[visible.length - 1].searched_at)}</span></div>
      <p className="trend-help">Hover, tap, or use the arrow keys to select a date and time on the line. Presets end at the latest saved check.</p>
      {visible.length < 2 && <p className="trend-help">Search this topic again later to see how it changes.</p>}
      <p className="trend-help">Each search samples up to 25 posts. A line flat at 25 may mean the sample limit was reached.</p>
      <div className="tracking-history">{[...visible].reverse().slice(0, 6).map(snapshot => <button type="button" key={snapshot.id} aria-pressed={selectedId === snapshot.id} onClick={() => { setSelectedId(snapshot.id); setHoveredIndex(null); }}><time>{dateLabel(snapshot.searched_at)}</time><span>{snapshot.mentions_count} mentions</span><span>{compact(snapshot.total_engagement)} engagement</span></button>)}</div>
    </>}
  </section>;
}
