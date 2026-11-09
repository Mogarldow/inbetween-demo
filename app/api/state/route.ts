import { NextRequest, NextResponse } from "next/server";
import { getClientState, q, type Client } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/state?client=petra  -> vše pro jednoho klienta
// GET /api/state               -> seznam klientů pro přehled psychologa
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("client");
  if (!id) {
    const clients = await q<Client & { open_alerts: number; last_checkin: string | null }>(
      `SELECT c.*,
              (SELECT count(*)::int FROM alerts a WHERE a.client_id = c.id AND a.resolved = FALSE) AS open_alerts,
              (SELECT max(created_at) FROM checkins k WHERE k.client_id = c.id) AS last_checkin
         FROM clients c ORDER BY c.waiting, c.name`,
    );
    return NextResponse.json({ clients });
  }
  const state = await getClientState(id);
  if (!state.client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });
  return NextResponse.json(state);
}
