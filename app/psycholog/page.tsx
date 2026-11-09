"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Alert, Checkin, Client, Event, Task } from "@/lib/db";

type ListClient = Client & { open_alerts: number; last_checkin: string | null };
type Detail = { client: Client; checkins: Checkin[]; tasks: Task[]; events: Event[]; alerts: Alert[] };

const POLL_MS = 3000;
const post = (url: string, body: unknown, method = "POST") =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const daysAgo = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : 99);
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", { weekday: "short", hour: "2-digit", minute: "2-digit" });
const dayShort = (iso: string) => new Date(iso).toLocaleDateString("cs-CZ", { weekday: "short" });

export default function PsychologPage() {
  const [clients, setClients] = useState<ListClient[]>([]);
  const [selected, setSelected] = useState("petra");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const seen = useRef<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const [l, d] = await Promise.all([
        fetch("/api/state", { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/state?client=${selected}`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (l.error || d.error) throw new Error(l.error || d.error);
      setClients(l.clients);
      setDetail(d);
      setError("");
    } catch {
      setError("Nepodařilo se načíst data. Běží databáze a je nastavená DATABASE_URL?");
    }
  }, [selected]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1><Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Most</Link></h1>
          <span className="tag">Přehled psychologa</span>
        </div>
        <Link className="note" href="/klient">Přejít na aplikaci klienta</Link>
      </header>
      {error && <p className="err">{error}</p>}
      <div className="pro">
        <aside className="side">
          <h3>Moji klienti</h3>
          {clients.map((c) => {
            const stale = !c.waiting && daysAgo(c.last_checkin) >= 3;
            return (
              <button key={c.id} className="cl" aria-current={c.id === selected} onClick={() => { setSelected(c.id); setDetail(null); }}>
                <b>{c.name}</b>
                <small>{c.next_session}</small>
                {c.open_alerts > 0 ? <span className="pill risk">Riziko</span>
                  : c.waiting ? <span className="pill warn">Čeká na 1. sezení</span>
                  : stale ? <span className="pill warn">{daysAgo(c.last_checkin)} dny bez check-inu</span>
                  : <span className="pill ok">Stabilní</span>}
              </button>
            );
          })}
        </aside>
        {detail ? <ClientDetail key={selected} d={detail} seen={seen.current} reload={load} /> : <div className="main"><p className="empty">Načítám…</p></div>}
      </div>
    </div>
  );
}

function ClientDetail({ d, seen, reload }: { d: Detail; seen: Set<number>; reload: () => void }) {
  const [plan, setPlan] = useState(d.client.plan);
  const [planState, setPlanState] = useState<"" | "dirty" | "saved">("");
  const [summary, setSummary] = useState("");
  const [sumBusy, setSumBusy] = useState(false);

  // nové události krátce zvýrazníme
  const fresh = new Set(d.events.filter((e) => !seen.has(e.id)).map((e) => e.id));
  const firstRender = useRef(true);
  useEffect(() => {
    d.events.forEach((e) => seen.add(e.id));
    firstRender.current = false;
  });

  async function savePlan() {
    await post("/api/plan", { clientId: d.client.id, plan }, "PUT");
    setPlanState("saved");
    reload();
  }

  async function resolveAlerts() {
    await post("/api/plan", { clientId: d.client.id }, "PATCH");
    reload();
  }

  async function makeSummary() {
    setSumBusy(true);
    setSummary("");
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: d.client.id }),
      });
      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setSummary(acc);
      }
    } catch {
      setSummary("Shrnutí se nepodařilo připravit. Zkuste to prosím znovu.");
    } finally {
      setSumBusy(false);
    }
  }

  const last = d.checkins.at(-1);
  const doneToday = d.tasks.filter((t) => t.done_today).length;

  return (
    <div className="main">
      <div className="main-head">
        <div><span className="label">{d.client.focus}</span><h2>{d.client.name}</h2></div>
        <span className="note">{d.client.next_session}</span>
      </div>

      {d.alerts.length > 0 && (
        <div className="box alert">
          <div className="row"><h3>Upozornění na riziko</h3><button className="btn ghost" onClick={resolveAlerts}>Beru na vědomí</button></div>
          {d.alerts.map((a) => <p key={a.id} style={{ margin: 0 }}><b>{fmt(a.created_at)}</b> {a.text}</p>)}
          <div className="decide">Klientovi byly automaticky zobrazeny linky 116 123 a 112. Další krok je na vás.</div>
        </div>
      )}

      <div className="grid2">
        <div className="box">
          <div className="row">
            <h3>Posledních 7 check-inů</h3>
            <div className="legend"><span><i style={{ background: "var(--accent)" }} />Nálada</span><span><i style={{ background: "var(--amber)" }} />Úzkost</span></div>
          </div>
          <Spark checkins={d.checkins} />
          <div className="stat">
            <div><b>{last ? `${last.mood}/5` : "–"}</b><small>poslední nálada</small></div>
            <div><b>{last ? `${last.anxiety}/10` : "–"}</b><small>poslední úzkost</small></div>
            <div><b>{doneToday}/{d.tasks.length}</b><small>úkoly dnes</small></div>
          </div>
        </div>
        <div className="box">
          <h3>Mezi sezeními</h3>
          <ul className="timeline">
            {d.events.map((e) => (
              <li key={e.id} className={fresh.has(e.id) && !firstRender.current ? "new" : ""}>
                <time>{fmt(e.created_at)}</time><span>{e.text}</span>
              </li>
            ))}
            {d.events.length === 0 && <li><span className="empty">Zatím nic.</span></li>}
          </ul>
        </div>
      </div>

      <div className="box">
        <div className="row">
          <h3>Shrnutí před sezením</h3>
          <button className="btn" disabled={sumBusy} onClick={makeSummary}>{summary ? "Připravit znovu" : "Připravit shrnutí"}</button>
        </div>
        <div className="summary">
          {summary ? <Mini md={summary} /> : (
            <span className="empty">{sumBusy ? "Claude čte check-iny, úkoly a rozhovory…" : "AI připraví návrh z check-inů, úkolů a rozhovorů."}</span>
          )}
        </div>
        <div className="decide">AI navrhuje, psycholog rozhoduje. Shrnutí není diagnóza ani doporučení léčby.</div>
      </div>

      <div className="box">
        <div className="row"><h3>Plán pro parťáka</h3><span className="label">Upravuje jen psycholog</span></div>
        <textarea id="plan" rows={6} value={plan} onChange={(e) => { setPlan(e.target.value); setPlanState("dirty"); }} />
        <div className="row">
          <span className="note">{planState === "saved" ? "Uloženo. Parťák se novým plánem řídí od další zprávy." : "Parťák se plánem řídí v každé odpovědi."}</span>
          <button className="btn" disabled={planState !== "dirty"} onClick={savePlan}>Uložit plán</button>
        </div>
      </div>
    </div>
  );
}

function Spark({ checkins }: { checkins: Checkin[] }) {
  const W = 320, H = 120, L = 22, R = 8, T = 10, B = 22, n = checkins.length;
  if (!n) return <p className="empty">Zatím žádné check-iny.</p>;
  const x = (i: number) => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1));
  const ym = (v: number) => T + (H - T - B) * (1 - (v - 1) / 4);
  const ya = (v: number) => T + (H - T - B) * (1 - v / 10);
  const path = (f: (v: number) => number, k: "mood" | "anxiety") =>
    checkins.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${f(c[k]).toFixed(1)}`).join(" ");
  const li = n - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Graf nálady a úzkosti">
      {[0, 1, 2, 3, 4].map((g) => {
        const y = T + (H - T - B) * g / 4;
        return <line key={g} x1={L} x2={W - R} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />;
      })}
      <text x={2} y={T + 4}>max</text>
      <text x={2} y={H - B + 4}>min</text>
      <path d={path(ya, "anxiety")} fill="none" stroke="var(--amber)" strokeWidth={2.5} strokeLinejoin="round" />
      <path d={path(ym, "mood")} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
      {checkins.map((c, i) => <text key={c.id} x={x(i)} y={H - 6} textAnchor="middle">{dayShort(c.created_at)}</text>)}
      <circle cx={x(li)} cy={ym(checkins[li].mood)} r={4} fill="var(--accent)" />
      <circle cx={x(li)} cy={ya(checkins[li].anxiety)} r={4} fill="var(--amber)" />
    </svg>
  );
}

// Minimální vykreslení odpovědi: **tučně** a odrážky „- “
function Mini({ md }: { md: string }) {
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p));
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`u${blocks.length}`}>{list.map((l, i) => <li key={i}>{bold(l)}</li>)}</ul>);
    list = [];
  };
  md.split("\n").forEach((raw) => {
    const line = raw.trim().replace(/^#+\s*/, "");
    if (/^[-•*]\s+/.test(line)) list.push(line.replace(/^[-•*]\s+/, ""));
    else { flush(); if (line) blocks.push(<p key={`p${blocks.length}`}>{bold(line)}</p>); }
  });
  flush();
  return <>{blocks}</>;
}
