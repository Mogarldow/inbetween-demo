import { NextRequest, NextResponse } from "next/server";
import { addAlert, addEvent, q } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { clientId, mood, anxiety, note } = await req.json();
  const m = Number(mood), a = Number(anxiety);
  if (!clientId || !(m >= 1 && m <= 5) || !(a >= 0 && a <= 10)) {
    return NextResponse.json({ error: "Nálada musí být 1–5 a úzkost 0–10." }, { status: 400 });
  }
  const text = typeof note === "string" ? note.trim().slice(0, 500) : "";
  await q("INSERT INTO checkins (client_id, mood, anxiety, note) VALUES ($1, $2, $3, $4)", [clientId, m, a, text || null]);
  await addEvent(clientId, `Check-in: nálada ${m}/5, úzkost ${a}/10.${text ? ` „${text}“` : ""}`);

  // Pravidlo pro upozornění: výrazně špatný stav dva check-iny po sobě.
  const prev = await q<{ mood: number; anxiety: number }>(
    "SELECT mood, anxiety FROM checkins WHERE client_id = $1 ORDER BY created_at DESC OFFSET 1 LIMIT 1",
    [clientId],
  );
  if (m <= 2 && a >= 8 && prev[0] && prev[0].mood <= 2 && prev[0].anxiety >= 7) {
    await addAlert(clientId, "zhorseni", `Výrazné zhoršení: nálada ${m}/5 a úzkost ${a}/10 druhý check-in po sobě.`);
  }
  return NextResponse.json({ ok: true });
}
