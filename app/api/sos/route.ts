import { NextRequest, NextResponse } from "next/server";
import { addAlert, addEvent } from "@/lib/db";

// Krizové tlačítko a spuštění dechového cvičení
export async function POST(req: NextRequest) {
  const { clientId, kind } = await req.json();
  if (!clientId) return NextResponse.json({ error: "Chybí klient." }, { status: 400 });
  if (kind === "breathing") {
    await addEvent(clientId, "Klient spustil dýchání 4-4-6.");
  } else {
    await addEvent(clientId, "Klient stiskl „Potřebuji pomoc hned“.");
    await addAlert(clientId, "sos", "Klient stiskl krizové tlačítko. Byly mu zobrazeny linky 116 123 a 112.");
  }
  return NextResponse.json({ ok: true });
}
