import { NextRequest, NextResponse } from "next/server";
import { q, type Material } from "@/lib/db";

export const dynamic = "force-dynamic";
const KINDS = ["technika", "ukol", "kbt", "poznamka"];

// Knihovna psychologa: seznam, přidání, úprava a smazání materiálu.
export async function GET() {
  const items = await q<Material & { used: number }>(
    "SELECT m.*, (SELECT count(*)::int FROM client_materials cm WHERE cm.material_id = m.id) AS used FROM materials m ORDER BY m.kind, m.id",
  );
  return NextResponse.json({ items });
}

function clean(b: Record<string, unknown>) {
  const kind = String(b.kind ?? "");
  const title = String(b.title ?? "").trim().slice(0, 120);
  const body = String(b.body ?? "").trim().slice(0, 2000);
  const goal = Math.max(0, Math.min(14, Number(b.week_goal) || 0));
  if (!KINDS.includes(kind) || !title) return null;
  return { kind, title, body, goal: kind === "ukol" ? goal || 3 : 0 };
}

export async function POST(req: NextRequest) {
  const m = clean(await req.json());
  if (!m) return NextResponse.json({ error: "Vyplň typ a název." }, { status: 400 });
  const [row] = await q<Material>("INSERT INTO materials (kind, title, body, week_goal) VALUES ($1, $2, $3, $4) RETURNING *", [m.kind, m.title, m.body, m.goal]);
  return NextResponse.json({ item: row });
}

export async function PUT(req: NextRequest) {
  const b = await req.json();
  const m = clean(b);
  if (!m || !Number(b.id)) return NextResponse.json({ error: "Neplatný materiál." }, { status: 400 });
  await q("UPDATE materials SET kind = $2, title = $3, body = $4, week_goal = $5 WHERE id = $1", [Number(b.id), m.kind, m.title, m.body, m.goal]);
  // Úkoly už přiřazené klientům převezmou nový název a popis.
  await q("UPDATE tasks SET title = $2, hint = $3, week_goal = $4 WHERE material_id = $1", [Number(b.id), m.title, m.body, m.goal]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Chybí id." }, { status: 400 });
  await q("DELETE FROM tasks WHERE material_id = $1", [id]);
  await q("DELETE FROM materials WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
