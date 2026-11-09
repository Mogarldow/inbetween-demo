import { Pool } from "pg";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Databáze: s DATABASE_URL se připojí k Postgresu (Neon, Vercel).
// Bez ní (lokální spuštění) použije vestavěný Postgres PGlite uložený ve složce .data,
// který se při prvním startu sám založí a naplní ukázkovými daty. Nic se neinstaluje.
type Rows = { rows: unknown[] };
type Conn = { query: (text: string, params?: unknown[]) => Promise<Rows>; release: () => void };
type Db = { query: (text: string, params?: unknown[]) => Promise<Rows>; connect: () => Promise<Conn> };

const g = globalThis as unknown as { __pool?: Db };

function pgPool(): Db {
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) as unknown as Db;
}

function pglitePool(): Db {
  const dataDir = process.env.PGLITE_DIR || join(process.cwd(), ".data", "pglite");
  let _ready: ReturnType<typeof open> | null = null;
  const open = async () => {
    mkdirSync(dataDir, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    const db = await PGlite.create(dataDir);
    const t = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'clients'");
    if (!t.rows[0].n) {
      for (const f of ["db/schema.sql", "db/seed.sql", "db/extras.sql"]) await db.exec(readFileSync(join(process.cwd(), f), "utf8"));
      console.log("Vestavěná databáze založena v", dataDir);
    }
    return db;
  };
  // PGlite má jedno spojení: dotazy řadíme za sebe, transakce drží zámek až do release().
  let chain: Promise<unknown> = Promise.resolve();
  const lock = () => {
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const acquired = chain.then(() => release);
    chain = chain.then(() => next);
    return acquired;
  };
  const raw = async (text: string, params?: unknown[]) => {
    const db = await (_ready ??= open());
    const r = await db.query(text, params as unknown[]);
    return { rows: r.rows as unknown[] };
  };
  return {
    async query(text, params) {
      const release = await lock();
      try { return await raw(text, params); } finally { release(); }
    },
    async connect() {
      const release = await lock();
      return { query: raw, release };
    },
  };
}

export const pool: Db = (g.__pool ??= process.env.DATABASE_URL ? pgPool() : pglitePool());

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function addEvent(clientId: string, text: string) {
  await q("INSERT INTO events (client_id, text) VALUES ($1, $2)", [clientId, text]);
}

export async function addAlert(clientId: string, kind: string, text: string) {
  await q("INSERT INTO alerts (client_id, kind, text) VALUES ($1, $2, $3)", [clientId, kind, text]);
}

export type Client = {
  id: string; name: string; salutation: string; therapist: string; focus: string; next_session: string; plan: string; waiting: boolean; allowed_techniques: string[];
  prep: string | null; share_thoughts: boolean; share_scores: boolean; share_chat: boolean;
  reminders: { title: string; when: string; on: boolean }[];
  solo: boolean;
};
export type Checkin = { id: number; mood: number; anxiety: number; note: string | null; created_at: string };
export type Task = { id: number; title: string; hint: string; week_done: number; week_goal: number; done_today: boolean };
export type Message = { id: number; role: "user" | "assistant"; content: string; created_at: string };
export type Event = { id: number; text: string; created_at: string };
export type ThoughtRecord = {
  id: number; situation: string; thought: string; emotion: string;
  intensity_before: number; balanced: string | null; intensity_after: number | null; created_at: string;
};
import type { Material } from "./materials";
export type { Material } from "./materials";
export const getClientMaterials = (id: string) =>
  q<Material>("SELECT m.* FROM materials m JOIN client_materials cm ON cm.material_id = m.id WHERE cm.client_id = $1 ORDER BY m.kind, m.id", [id]);
export type Score = { id: number; kind: "gad7" | "phq9"; score: number; item9: number | null; created_at: string };
export type Outreach = { id: number; text: string; created_at: string };
export type WaitPerson = { id: number; name: string; weeks: number; gad7: number; phq9: number; item9: number; modules_done: number; note: string | null; client_id: string | null };
export type Alert = { id: number; kind: string; text: string; resolved: boolean; created_at: string };

export async function getClient(id: string) {
  const rows = await q<Client>("SELECT * FROM clients WHERE id = $1", [id]);
  return rows[0] ?? null;
}

/** Vše o klientovi. Pro psychologa (forTherapist) respektuje souhlasy klienta se sdílením. */
export async function getClientState(id: string, forTherapist = false) {
  const [client, checkins, tasks, messages, events, alerts, thoughts, scores, outreach, req, materials] = await Promise.all([
    getClient(id),
    q<Checkin>("SELECT * FROM (SELECT * FROM checkins WHERE client_id = $1 ORDER BY created_at DESC LIMIT 7) t ORDER BY created_at", [id]),
    q<Task>("SELECT * FROM tasks WHERE client_id = $1 ORDER BY id", [id]),
    q<Message>("SELECT * FROM (SELECT * FROM messages WHERE client_id = $1 ORDER BY created_at DESC LIMIT 40) t ORDER BY created_at", [id]),
    q<Event>("SELECT * FROM events WHERE client_id = $1 ORDER BY created_at DESC LIMIT 30", [id]),
    q<Alert>("SELECT * FROM alerts WHERE client_id = $1 AND resolved = FALSE ORDER BY created_at DESC", [id]),
    q<ThoughtRecord>("SELECT * FROM thought_records WHERE client_id = $1 ORDER BY created_at DESC LIMIT 10", [id]),
    q<Score>("SELECT * FROM questionnaires WHERE client_id = $1 ORDER BY created_at", [id]),
    q<Outreach>("SELECT * FROM outreach WHERE client_id = $1 ORDER BY created_at", [id]),
    q("SELECT 1 FROM waitlist WHERE client_id = $1", [id]),
    getClientMaterials(id),
  ]);
  const requested = req.length > 0; // uživatel bez psychologa už požádal o psychologa
  if (forTherapist && client) {
    return {
      client, checkins, tasks, events, alerts, outreach, materials,
      messages: client.share_chat ? messages : [],
      thoughts: client.share_thoughts ? thoughts : [],
      scores: client.share_scores ? scores : [],
    };
  }
  return { client, checkins, tasks, messages, events, alerts, thoughts, scores, outreach, requested, materials };
}
