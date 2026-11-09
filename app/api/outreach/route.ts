import { NextRequest, NextResponse } from "next/server";
import { addEvent, getClientState, q } from "@/lib/db";
import { streamText } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const daysAgo = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);

// POST {clientId, draft: true} -> AI navrhne zprávu; POST {clientId, text} -> psycholog ji odešle klientovi
export async function POST(req: NextRequest) {
  const { clientId, text, draft } = await req.json();
  const s = await getClientState(clientId, true);
  if (!s.client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });

  if (!draft) {
    const v = typeof text === "string" ? text.trim().slice(0, 1500) : "";
    if (!v) return NextResponse.json({ error: "Zpráva je prázdná." }, { status: 400 });
    await q("INSERT INTO outreach (client_id, text) VALUES ($1, $2)", [clientId, v]);
    await addEvent(clientId, "Psycholog poslal klientovi zprávu.");
    return NextResponse.json({ ok: true });
  }

  const last = s.checkins.at(-1);
  const gap = daysAgo(last?.created_at);
  const first = s.client.therapist.split(" ").at(-2) ?? "";
  const done = s.tasks.filter((t) => t.week_done > 0).map((t) => t.title.toLowerCase());
  const demo = `Ahoj ${s.client.salutation}, myslím na tebe.${done.length ? ` Viděla jsem, že se ti tento týden povedlo ${done[0]}, to se počítá.` : ""} Zkus dnes jednu malou věc z plánu, klidně jen na deset minut, a na sezení (${s.client.next_session}) si o tom v klidu popovídáme. ${first}`.trim();

  const { body } = streamText({
    messages: [{
      role: "user",
      content: `Jsi asistent psycholožky ${s.client.therapist}. Navrhni krátkou zprávu (nejvýš 3 věty), kterou pošle klientovi ${s.client.name} do aplikace. Píše ji psycholožka za sebe, česky, tyká (domluvili se tak), oslovení „${s.client.salutation}“, vřele a bez tlaku. Nevyčítej vynechané check-iny. Nabídni jeden malý krok z plánu. Žádné diagnózy.

Plán: ${s.client.plan}
Dní od posledního check-inu: ${gap ?? "nikdy"}${last ? `; poslední: nálada ${last.mood}/5, úzkost ${last.anxiety}/10${last.note ? ` „${last.note}“` : ""}` : ""}
Úkoly: ${s.tasks.map((t) => `${t.title} ${t.week_done}/${t.week_goal}`).join("; ")}
Dotazníky: ${s.scores.map((x) => `${x.kind} ${x.score}`).join(", ") || "nesdílí"}
Příští sezení: ${s.client.next_session}`,
    }],
    effort: "low",
    maxTokens: 2000,
    fallbackText: demo,
    demoText: demo,
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
