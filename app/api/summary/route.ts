import { NextRequest, NextResponse } from "next/server";
import { getClientState } from "@/lib/db";
import { streamText, summaryPrompt } from "@/lib/claude";
import { demoSummary } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { clientId } = await req.json();
  const state = await getClientState(clientId);
  if (!state.client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });

  const { body } = streamText({
    messages: [{ role: "user", content: summaryPrompt(state.client, state) }],
    effort: "medium",
    maxTokens: 8000,
    fallbackText: "Shrnutí se teď nepodařilo připravit. Zkuste to prosím za chvíli znovu.",
    demoText: demoSummary(state.client, state),
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
