import { NextRequest, NextResponse } from "next/server";
import { addEvent, q } from "@/lib/db";

const clip = (v: unknown, n = 500) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const pct = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;
};

// Uloží záznam z deníku myšlenek (KBT)
export async function POST(req: NextRequest) {
  const b = await req.json();
  const situation = clip(b.situation), thought = clip(b.thought), emotion = clip(b.emotion, 80);
  const before = pct(b.intensityBefore), after = pct(b.intensityAfter);
  const balanced = clip(b.balanced);
  if (!b.clientId || !situation || !thought || !emotion || before === null) {
    return NextResponse.json({ error: "Vyplň situaci, myšlenku, emoci a její sílu." }, { status: 400 });
  }
  await q(
    `INSERT INTO thought_records (client_id, situation, thought, emotion, intensity_before, balanced, intensity_after)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [b.clientId, situation, thought, emotion, before, balanced || null, balanced ? after : null],
  );
  // odškrtne úkol „Deník myšlenek“, pokud ho klient má
  await q(
    `UPDATE tasks SET done_today = TRUE, week_done = LEAST(week_goal, week_done + 1)
      WHERE client_id = $1 AND title ILIKE 'deník myšlenek%' AND done_today = FALSE`,
    [b.clientId],
  );
  await addEvent(
    b.clientId,
    `Deník myšlenek: „${thought.slice(0, 80)}“ (${emotion} ${before} %${balanced && after !== null ? ` → ${after} %` : ""})`,
  );
  return NextResponse.json({ ok: true });
}
