import { NextRequest, NextResponse } from "next/server";
import { addEvent, getClient, pool, q, type Material } from "@/lib/db";

export const dynamic = "force-dynamic";

// Psycholog vybere z knihovny, co klientovi na tento týden povolí.
// Úkoly z výběru se klientovi objeví v seznamu úkolů, ostatní v jeho plánu a zná je parťák.
export async function PUT(req: NextRequest) {
  const { clientId, materialIds } = await req.json();
  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });
  const ids: number[] = Array.isArray(materialIds) ? materialIds.map(Number).filter((n: number) => n > 0) : [];
  const chosen = ids.length ? await q<Material>("SELECT * FROM materials WHERE id = ANY($1::int[])", [ids]) : [];

  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("DELETE FROM client_materials WHERE client_id = $1", [client.id]);
    for (const m of chosen) await db.query("INSERT INTO client_materials (client_id, material_id) VALUES ($1, $2)", [client.id, m.id]);
    const taskIds = chosen.filter((m) => m.kind === "ukol").map((m) => m.id);
    await db.query("DELETE FROM tasks WHERE client_id = $1 AND material_id IS NOT NULL AND NOT (material_id = ANY($2::int[]))", [client.id, taskIds]);
    for (const m of chosen.filter((m) => m.kind === "ukol")) {
      await db.query(
        "INSERT INTO tasks (client_id, title, hint, week_goal, material_id) SELECT $1, $2, $3, $4, $5 WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE client_id = $1 AND material_id = $5)",
        [client.id, m.title, m.body, m.week_goal, m.id],
      );
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
  await addEvent(client.id, chosen.length ? `Psycholog na tento týden povolil: ${chosen.map((m) => m.title).join(", ")}.` : "Psycholog zrušil výběr materiálů na tento týden.");
  return NextResponse.json({ ok: true });
}
