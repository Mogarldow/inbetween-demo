import { NextRequest, NextResponse } from "next/server";
import { getClientState } from "@/lib/db";

export const dynamic = "force-dynamic";

// Export všech dat klienta (právo na přenositelnost, čl. 20 GDPR). V reálném provozu za přihlášením.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("client") ?? "";
  const s = await getClientState(id);
  if (!s.client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });
  const body = JSON.stringify({ exportovano: new Date().toISOString(), ...s }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="inbetween-${id}-data.json"`,
      "Cache-Control": "no-store",
    },
  });
}
