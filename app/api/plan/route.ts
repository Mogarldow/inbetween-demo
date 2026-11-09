import { NextRequest, NextResponse } from "next/server";
import { addEvent, q } from "@/lib/db";
import { getTechnique } from "@/lib/techniques";

export async function PUT(req: NextRequest) {
  const { clientId, plan, allowedTechniques } = await req.json();
  if (!clientId || typeof plan !== "string" || !plan.trim()) {
    return NextResponse.json({ error: "Plán nesmí být prázdný." }, { status: 400 });
  }
  const allowed = Array.isArray(allowedTechniques)
    ? allowedTechniques.filter((id: unknown): id is string => typeof id === "string" && !!getTechnique(id))
    : null;
  if (allowed) {
    await q("UPDATE clients SET plan = $2, allowed_techniques = $3 WHERE id = $1", [clientId, plan.slice(0, 4000), allowed]);
  } else {
    await q("UPDATE clients SET plan = $2 WHERE id = $1", [clientId, plan.slice(0, 4000)]);
  }
  await addEvent(clientId, "Psycholog upravil plán a techniky pro parťáka.");
  return NextResponse.json({ ok: true });
}

// Psycholog označí upozornění jako vyřešená
export async function PATCH(req: NextRequest) {
  const { clientId } = await req.json();
  await q("UPDATE alerts SET resolved = TRUE WHERE client_id = $1", [clientId]);
  await addEvent(clientId, "Psycholog vzal upozornění na vědomí.");
  return NextResponse.json({ ok: true });
}
