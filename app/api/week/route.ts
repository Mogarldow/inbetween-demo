import { NextRequest, NextResponse } from "next/server";
import { getClientState } from "@/lib/db";
import { streamText } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Čísla za týden (od nejstaršího zobrazeného check-inu). */
export async function POST(req: NextRequest) {
  const { clientId } = await req.json();
  const s = await getClientState(clientId);
  if (!s.client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });
  const c = s.checkins;
  const practice = s.tasks.reduce((n, t) => n + t.week_done, 0);
  const done = s.thoughts.filter((t) => t.intensity_after !== null);
  const drop = done.length ? Math.round(done.reduce((a, t) => a + (t.intensity_before - (t.intensity_after ?? 0)), 0) / done.length) : 0;
  const best = [...s.tasks].sort((a, b) => b.week_done - a.week_done)[0];
  const demo = `Tenhle týden jsi to nevzdal/a: ${c.length}× check-in a ${practice}× úkoly z plánu${best ? `, nejčastěji ${best.title.toLowerCase()}` : ""}.${done.length ? ` Po zápisu do deníku emoce v průměru klesla o ${drop} %.` : ""} Na příští dny si vyber jednu techniku z plánu a zkus ji hned ráno.`;

  const { body } = streamText({
    messages: [{
      role: "user",
      content: `Jsi Inbetween, AI parťák klienta ${s.client.name} (oslovení „${s.client.salutation}“). Napiš krátké shrnutí týdne (nejvýš 3 věty), česky, tykáš, vřele a konkrétně. Pochval konkrétní snahu, ne výsledek. Nic nediagnostikuj. Pokud je úzkost vyšší, nevyčítej to, jen nabídni jednu techniku z plánu.

Data: ${c.length} check-inů, nálada ${c.map((x) => x.mood).join(", ")}, úzkost ${c.map((x) => x.anxiety).join(", ")}; úkoly ${s.tasks.map((t) => `${t.title} ${t.week_done}/${t.week_goal}`).join("; ")}; deník ${s.thoughts.length}× (pokles emoce ${drop} %); dotazníky ${s.scores.map((x) => `${x.kind} ${x.score}`).join(", ") || "nic"}.
Plán: ${s.client.plan}`,
    }],
    effort: "low",
    maxTokens: 2000,
    fallbackText: demo,
    demoText: demo,
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
