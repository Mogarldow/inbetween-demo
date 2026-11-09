import { Pool } from "pg";

// Jeden pool na proces (Next.js v dev režimu modul načítá opakovaně).
const g = globalThis as unknown as { __pool?: Pool };
export const pool =
  g.__pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });
if (process.env.NODE_ENV !== "production") g.__pool = pool;

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
};
export type Checkin = { id: number; mood: number; anxiety: number; note: string | null; created_at: string };
export type Task = { id: number; title: string; hint: string; week_done: number; week_goal: number; done_today: boolean };
export type Message = { id: number; role: "user" | "assistant"; content: string; created_at: string };
export type Event = { id: number; text: string; created_at: string };
export type ThoughtRecord = {
  id: number; situation: string; thought: string; emotion: string;
  intensity_before: number; balanced: string | null; intensity_after: number | null; created_at: string;
};
export type Alert = { id: number; kind: string; text: string; resolved: boolean; created_at: string };

export async function getClient(id: string) {
  const rows = await q<Client>("SELECT * FROM clients WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function getClientState(id: string) {
  const [client, checkins, tasks, messages, events, alerts, thoughts] = await Promise.all([
    getClient(id),
    q<Checkin>("SELECT * FROM (SELECT * FROM checkins WHERE client_id = $1 ORDER BY created_at DESC LIMIT 7) t ORDER BY created_at", [id]),
    q<Task>("SELECT * FROM tasks WHERE client_id = $1 ORDER BY id", [id]),
    q<Message>("SELECT * FROM (SELECT * FROM messages WHERE client_id = $1 ORDER BY created_at DESC LIMIT 40) t ORDER BY created_at", [id]),
    q<Event>("SELECT * FROM events WHERE client_id = $1 ORDER BY created_at DESC LIMIT 30", [id]),
    q<Alert>("SELECT * FROM alerts WHERE client_id = $1 AND resolved = FALSE ORDER BY created_at DESC", [id]),
    q<ThoughtRecord>("SELECT * FROM thought_records WHERE client_id = $1 ORDER BY created_at DESC LIMIT 10", [id]),
  ]);
  return { client, checkins, tasks, messages, events, alerts, thoughts };
}
