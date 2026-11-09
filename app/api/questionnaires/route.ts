import { NextRequest, NextResponse } from "next/server";
import { addAlert, addEvent, getClient, q } from "@/lib/db";
import { QUESTIONNAIRES, band, isQKind } from "@/lib/questionnaires";

export const dynamic = "force-dynamic";

// Uloží vyplněný GAD-7 nebo PHQ-9. Kladná odpověď na otázku 9 PHQ-9 hned upozorní psychologa.
export async function POST(req: NextRequest) {
  const { clientId, kind, answers } = await req.json();
  if (!isQKind(kind)) return NextResponse.json({ error: "Neznámý dotazník." }, { status: 400 });
  const def = QUESTIONNAIRES[kind];
  if (!Array.isArray(answers) || answers.length !== def.items.length || !answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 3)) {
    return NextResponse.json({ error: "Odpověz prosím na všechny otázky." }, { status: 400 });
  }
  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });

  const score = (answers as number[]).reduce((s, a) => s + a, 0);
  const item9 = kind === "phq9" ? (answers as number[])[8] : null;
  const prev = await q<{ score: number }>(
    "SELECT score FROM questionnaires WHERE client_id = $1 AND kind = $2 ORDER BY created_at DESC LIMIT 1",
    [clientId, kind],
  );
  await q("INSERT INTO questionnaires (client_id, kind, score, item9) VALUES ($1, $2, $3, $4)", [clientId, kind, score, item9]);
  const b = band(kind, score);
  await addEvent(clientId, `${def.name}: ${score} bodů (${b.label})${client.share_scores ? "" : " · výsledek klient nesdílí"}.`);
  const risk = !!item9 && item9 > 0;
  if (risk) {
    // bezpečnost má přednost před souhlasem se sdílením skóre
    await addAlert(clientId, "phq9", "PHQ-9: kladná odpověď na otázku 9 (myšlenky na smrt nebo sebepoškození). Klientovi zobrazeny linky 116 123 a 112.");
  }
  return NextResponse.json({ score, max: def.max, band: b.label, prev: prev[0]?.score ?? null, risk });
}
