import { NextRequest, NextResponse } from "next/server";
import { getClient, q, type Score } from "@/lib/db";

export const dynamic = "force-dynamic";

// Uživatel bez psychologa požádá o psychologa: zařadí se do čekárny (s jeho souhlasem i se skóre dotazníků).
export async function POST(req: NextRequest) {
  const { clientId, topics, form, share } = await req.json();
  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: "Uživatel neexistuje." }, { status: 404 });
  const existing = await q("SELECT 1 FROM waitlist WHERE client_id = $1", [clientId]);
  if (existing.length) return NextResponse.json({ ok: true, already: true });

  const scores = await q<Score>("SELECT * FROM questionnaires WHERE client_id = $1 ORDER BY created_at DESC", [clientId]);
  const gad = scores.find((s) => s.kind === "gad7"), phq = scores.find((s) => s.kind === "phq9");
  const t = (Array.isArray(topics) ? topics : []).map(String).slice(0, 6).join(", ");
  const note = [t, typeof form === "string" ? form.slice(0, 30) : "", "z aplikace", share ? "" : "skóre nesdílí"].filter(Boolean).join(" · ");
  await q(
    `INSERT INTO waitlist (name, weeks, gad7, phq9, item9, modules_done, note, client_id) VALUES ($1, 0, $2, $3, $4, 0, $5, $6)`,
    [client.name, share ? gad?.score ?? 0 : 0, share ? phq?.score ?? 0 : 0, phq?.item9 ?? 0, note, clientId],
  );
  return NextResponse.json({ ok: true });
}
