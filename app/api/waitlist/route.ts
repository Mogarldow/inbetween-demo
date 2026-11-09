import { NextResponse } from "next/server";
import { q, type WaitPerson } from "@/lib/db";
import { streamText } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const order = (w: WaitPerson[]) =>
  [...w].sort((a, b) => b.item9 - a.item9 || b.phq9 + b.gad7 - (a.phq9 + a.gad7) || b.weeks - a.weeks);

export async function GET() {
  return NextResponse.json({ people: await q<WaitPerson>("SELECT * FROM waitlist ORDER BY weeks DESC") });
}

// AI navrhne pořadí prvních sezení. Kladná otázka 9 má vždy přednost (hlídá ji i kód, ne jen AI).
export async function POST() {
  const people = await q<WaitPerson>("SELECT * FROM waitlist");
  const data = people.map((p) => `${p.name}: čeká ${p.weeks} týdnů, GAD-7 ${p.gad7}, PHQ-9 ${p.phq9}, otázka 9: ${p.item9}, program ${p.modules_done}/6${p.note ? `, ${p.note}` : ""}`).join("\n");
  const demo = order(people)
    .map((p, i) => `${i + 1}. ${p.name}: ${p.item9 ? "kladná otázka 9, kontaktovat dnes" : `GAD-7 ${p.gad7}, PHQ-9 ${p.phq9}, čeká ${p.weeks} týd.`}`)
    .join("\n") + "\nPozor: návrh vychází jen z dotazníků, rozhodnutí je na vás.";
  const { body } = streamText({
    messages: [{
      role: "user",
      content: `Jsi asistent psycholožky. Navrhni pořadí, v jakém zvát lidi z čekárny na první sezení. Česky, číslovaný seznam „1. Jméno: důvod“ (důvod nejvýš 12 slov), pak jedna věta „Pozor:“. Kladná otázka 9 PHQ-9 má vždy přednost. Žádné diagnózy, je to jen návrh.\n\n${data}`,
    }],
    effort: "low",
    maxTokens: 2000,
    fallbackText: demo,
    demoText: demo,
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
