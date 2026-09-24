import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ error: "Use the dashboard to start analysis." }, { status: 403 });
  const key = process.env.JEV_API_KEY;
  if (!key) return NextResponse.json({ error: "Jev key is not configured." }, { status: 503 });
  let body: { query?: unknown; text?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof body.query !== "string" || typeof body.text !== "string" || !body.query.trim() || !body.text.trim() || body.query.length > 300 || body.text.length > 8000) return NextResponse.json({ error: "Provide a short topic and post." }, { status: 400 });
  try {
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST", signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "jev-latest",
        state: { topic: body.query, post: body.text },
        questions: { sentiment: { type: "choice", instructions: "Classify the author's sentiment toward the topic in this post. An advertisement or factual offer without an opinion about the topic is neutral.", criteria: {
          positive: "Explicit praise or positive opinion about the topic",
          neutral: "Informational, promotional, or mixed with no clear opinion about the topic",
          negative: "Explicit criticism or negative opinion about the topic",
        } } },
      }),
    });
    if (!response.ok) return NextResponse.json({ error: "Jev analysis is unavailable." }, { status: 502 });
    const data = await response.json();
    const result = data?.answers?.sentiment;
    if (!["positive", "neutral", "negative"].includes(result?.choice)) throw new Error("Invalid response");
    return NextResponse.json({ sentiment: result.choice, confidence: result.confidence, model: data.model });
  } catch { return NextResponse.json({ error: "Jev analysis timed out or returned an invalid result." }, { status: 502 }); }
}
