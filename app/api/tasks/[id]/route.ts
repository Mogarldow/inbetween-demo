import { NextRequest, NextResponse } from "next/server";
import { addEvent, q } from "@/lib/db";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { done } = await req.json();
  const rows = await q<{ client_id: string; title: string; done_today: boolean }>(
    "SELECT client_id, title, done_today FROM tasks WHERE id = $1",
    [Number(id)],
  );
  const task = rows[0];
  if (!task) return NextResponse.json({ error: "Úkol neexistuje." }, { status: 404 });
  if (task.done_today === Boolean(done)) return NextResponse.json({ ok: true });

  await q(
    `UPDATE tasks SET done_today = $2,
            week_done = GREATEST(0, LEAST(week_goal, week_done + CASE WHEN $2 THEN 1 ELSE -1 END))
      WHERE id = $1`,
    [Number(id), Boolean(done)],
  );
  if (done) await addEvent(task.client_id, `Splněno: ${task.title.toLowerCase()}.`);
  return NextResponse.json({ ok: true });
}
