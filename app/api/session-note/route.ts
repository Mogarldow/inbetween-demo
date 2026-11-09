import { NextRequest, NextResponse } from "next/server";
import { addEvent, getClient, pool, q, type Task } from "@/lib/db";
import { completeText } from "@/lib/claude";
import { DEMO_MODE } from "@/lib/demo";
import { TECHNIQUES, getTechnique, CRISIS_TECHNIQUE_ID } from "@/lib/techniques";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

type Proposal = { summary: string; plan: string; tasks: { title: string; hint: string; goal: number }[]; techniques: string[] };

const clean = (p: Partial<Proposal>): Proposal | null => {
  if (typeof p?.plan !== "string" || !p.plan.trim() || !Array.isArray(p.tasks)) return null;
  return {
    summary: String(p.summary ?? "").slice(0, 400),
    plan: p.plan.trim().slice(0, 4000),
    tasks: p.tasks.slice(0, 5).map((t) => ({
      title: String(t?.title ?? "Úkol").slice(0, 60),
      hint: String(t?.hint ?? "").slice(0, 120),
      goal: Math.max(1, Math.min(7, Math.round(Number(t?.goal) || 3))),
    })),
    techniques: (Array.isArray(p.techniques) ? p.techniques : []).filter((id) => id !== CRISIS_TECHNIQUE_ID && !!getTechnique(id)),
  };
};

/** Návrh bez AI (ukázkový režim): ponechá plán, připíše zápis a zachová úkoly. */
function demoProposal(plan: string, tasks: Task[], allowed: string[], note: string): Proposal {
  return {
    summary: "Ukázkový režim: plán jsem doplnil o poznámky ze sezení, úkoly a techniky zůstávají. S API klíčem by návrh připravil Claude.",
    plan: `${plan.trim()}\nZe sezení: ${note.replace(/\s+/g, " ").slice(0, 300)}`,
    tasks: tasks.map((t) => ({ title: t.title, hint: t.hint, goal: t.week_goal })),
    techniques: allowed,
  };
}

// POST {clientId, note} -> návrh nového plánu (nic neukládá)
export async function POST(req: NextRequest) {
  const { clientId, note } = await req.json();
  const text = typeof note === "string" ? note.trim().slice(0, 3000) : "";
  if (!text) return NextResponse.json({ error: "Napište pár vět o sezení." }, { status: 400 });
  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });
  const tasks = await q<Task>("SELECT * FROM tasks WHERE client_id = $1 ORDER BY id", [clientId]);
  const fallback = demoProposal(client.plan, tasks, client.allowed_techniques, text);
  if (DEMO_MODE) return NextResponse.json(fallback);

  const lib = TECHNIQUES.filter((t) => t.id !== CRISIS_TECHNIQUE_ID).map((t) => `${t.id}: ${t.title} (${t.whenToUse})`).join("\n");
  try {
    const raw = await completeText(`Jsi asistent psychologa. Ze zápisu ze sezení navrhni úpravu plánu pro AI parťáka klienta ${client.name} (${client.focus}). Odpověz POUZE JSON objektem bez dalšího textu:
{"summary": "jedna věta o posunu a změnách", "plan": "celý nový text plánu ve stejném stylu jako současný", "tasks": [{"title": "krátký název", "hint": "krátký pokyn", "goal": počet za týden 1-7}], "techniques": ["id techniky"]}
Úkolů 2–4. Techniky vybírej jen z knihovny (podle id). Drž se zápisu, nic si nevymýšlej, žádné diagnózy ani léky.

<soucasny_plan>
${client.plan}
</soucasny_plan>
<soucasne_ukoly>
${tasks.map((t) => `${t.title} (${t.week_goal}× týdně): ${t.hint}`).join("\n")}
</soucasne_ukoly>
<soucasne_techniky>${client.allowed_techniques.join(", ")}</soucasne_techniky>
<knihovna>
${lib}
</knihovna>
<zapis_ze_sezeni>
${text}
</zapis_ze_sezeni>`, "medium", 6000);
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    return NextResponse.json(clean(JSON.parse(json)) ?? fallback);
  } catch (err) {
    console.error("session-note:", err);
    return NextResponse.json({ ...fallback, summary: "AI teď návrh nepřipravila, níže je současný plán doplněný o zápis." });
  }
}

// PUT {clientId, plan, tasks, techniques} -> psycholog návrh potvrdil
export async function PUT(req: NextRequest) {
  const b = await req.json();
  const client = await getClient(b.clientId);
  if (!client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });
  const p = clean(b);
  if (!p) return NextResponse.json({ error: "Neplatný návrh." }, { status: 400 });

  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("UPDATE clients SET plan = $2, allowed_techniques = $3 WHERE id = $1", [client.id, p.plan, p.techniques]);
    await db.query("DELETE FROM tasks WHERE client_id = $1", [client.id]);
    for (const t of p.tasks) {
      await db.query("INSERT INTO tasks (client_id, title, hint, week_goal) VALUES ($1, $2, $3, $4)", [client.id, t.title, t.hint, t.goal]);
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
  await addEvent(client.id, "Psycholog potvrdil nový plán a úkoly ze zápisu ze sezení.");
  return NextResponse.json({ ok: true });
}
