import { NextRequest, NextResponse } from "next/server";
import { addEvent, getClient, pool, q, type WaitPerson } from "@/lib/db";

export const dynamic = "force-dynamic";

const THERAPIST = "Mgr. Jana Dvořáková"; // v demu je jeden přihlášený psycholog
const START_TECHNIQUES = ["dech-446", "uzemneni-54321", "zaznam-myslenek", "prochazka"];

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "klient";

/**
 * Psycholog přidá nového klienta, nebo přijme člověka z čekárny.
 * Když člověk z čekárny už používá aplikaci (bez psychologa), jeho účet se převede:
 * zůstanou mu check-iny, deník i rozhovory, jen dostane psychologa a plán.
 */
export async function POST(req: NextRequest) {
  const b = await req.json();
  const name = String(b.name ?? "").trim().slice(0, 60);
  const salutation = String(b.salutation ?? "").trim().slice(0, 40) || name.split(" ")[0];
  const focus = String(b.focus ?? "").trim().slice(0, 80) || "Úvodní fáze";
  const next = String(b.next_session ?? "").trim().slice(0, 60) || "Domluvit termín";
  const waitId = Number(b.waitId) || null;
  if (!name) return NextResponse.json({ error: "Vyplň jméno klienta." }, { status: 400 });

  let wait: WaitPerson | undefined;
  if (waitId) [wait] = await q<WaitPerson>("SELECT * FROM waitlist WHERE id = $1", [waitId]);

  const plan = `Úvodní fáze (${focus}).\nCíl: zmapovat, kdy potíže přicházejí, a naučit se 1–2 způsoby, jak je zvládat.\nKaždý den: krátký check-in. Když úzkost stoupá: dýchání 4-4-6.\nPlán upřesníme po prvním sezení.`;

  const db = await pool.connect();
  let id: string;
  try {
    await db.query("BEGIN");
    if (wait?.client_id) {
      // Převzetí uživatele, který zatím používal aplikaci bez psychologa.
      id = wait.client_id;
      await db.query(
        "UPDATE clients SET solo = FALSE, therapist = $2, focus = $3, next_session = $4, salutation = $5, plan = $6 || E'\\n\\nPředtím používal/a samostatný program, výsledky jsou v historii.' WHERE id = $1",
        [id, THERAPIST, focus, next, salutation, plan],
      );
    } else {
      id = `${slug(name)}-${Math.random().toString(36).slice(2, 6)}`;
      await db.query(
        "INSERT INTO clients (id, name, salutation, therapist, focus, next_session, plan, allowed_techniques) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [id, name, salutation, THERAPIST, focus, next, plan, START_TECHNIQUES],
      );
      await db.query("INSERT INTO tasks (client_id, title, hint, week_goal) VALUES ($1, 'Denní check-in', 'Večer, zabere minutu.', 7), ($1, 'Dýchání 4-4-6', 'Když úzkost stoupne.', 3)", [id]);
      await db.query("INSERT INTO messages (client_id, role, content) VALUES ($1, 'assistant', $2)", [id, `Ahoj ${salutation}, jsem Inbetween, tvůj parťák mezi sezeními s ${THERAPIST}. Můžeš mi napsat kdykoli.`]);
      if (wait) {
        const at = "now() - interval '1 day'";
        await db.query(`INSERT INTO questionnaires (client_id, kind, score, item9, created_at) VALUES ($1, 'gad7', $2, NULL, ${at}), ($1, 'phq9', $3, $4, ${at})`, [id, wait.gad7, wait.phq9, wait.item9]);
      }
    }
    if (wait) await db.query("DELETE FROM waitlist WHERE id = $1", [wait.id]);
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
  await addEvent(id, wait ? `Přijat/a z čekárny do péče. První sezení: ${next}.` : `Nový klient v péči. První sezení: ${next}.`);
  const client = await getClient(id);
  return NextResponse.json({ id, client });
}
