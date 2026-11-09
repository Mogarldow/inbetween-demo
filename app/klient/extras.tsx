"use client";

// Doplňky aplikace klienta: dotazníky, příprava na sezení, připomínky, soukromí a diktování.
import { useEffect, useRef, useState } from "react";
import type { Client, Outreach, Score } from "@/lib/db";
import { OPTIONS, QUESTIONNAIRES, type QKind } from "@/lib/questionnaires";

const post = (url: string, body: unknown, method = "POST") =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function streamInto(res: Response, onText: (t: string) => void) {
  if (!res.ok || !res.body) throw new Error();
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let acc = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    acc += dec.decode(value, { stream: true });
    onText(acc);
  }
  return acc;
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });

/* ---------- zpráva od psychologa ---------- */
export function OutreachCard({ outreach, therapist }: { outreach: Outreach[]; therapist: string }) {
  const last = outreach.at(-1);
  if (!last) return null;
  return (
    <div className="card" style={{ borderColor: "var(--accent)" }}>
      <div className="row"><h3>{therapist} ti posílá zprávu</h3><span className="label">{fmtDay(last.created_at)}</span></div>
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{last.text}</p>
    </div>
  );
}

/* ---------- dotazníky ---------- */
export function QuestionnairesCard({ scores, onOpen }: { scores: Score[]; onOpen: (k: QKind) => void }) {
  const lastOf = (k: QKind) => scores.filter((s) => s.kind === k).at(-1);
  return (
    <div className="card">
      <div className="row"><h3>Jak se ti daří</h3><span className="label">Jednou za 2 týdny</span></div>
      <p className="note" style={{ margin: 0 }}>Krátké dotazníky, které používají psychologové. Tvůj psycholog z nich uvidí, jestli se ti ulevuje.</p>
      {(["gad7", "phq9"] as QKind[]).map((k) => {
        const l = lastOf(k);
        return (
          <div className="task" key={k}>
            <div>
              <b>{QUESTIONNAIRES[k].title}</b>
              <small>{l ? `Naposledy ${fmtDay(l.created_at)}: ${l.score} bodů z ${QUESTIONNAIRES[k].max}.` : `${QUESTIONNAIRES[k].items.length} otázek, asi minuta.`}</small>
            </div>
            <button type="button" className="btn ghost sm" onClick={() => onOpen(k)}>Vyplnit</button>
          </div>
        );
      })}
    </div>
  );
}

export function QuestionnaireSheet({ kind, clientId, onClose, onSaved }: { kind: QKind; clientId: string; onClose: () => void; onSaved: () => void }) {
  const def = QUESTIONNAIRES[kind];
  const [ans, setAns] = useState<(number | null)[]>(() => def.items.map(() => null));
  const [res, setRes] = useState<null | { score: number; max: number; band: string; prev: number | null; risk: boolean }>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true); setErr("");
    const r = await post("/api/questionnaires", { clientId, kind, answers: ans });
    setBusy(false);
    const j = await r.json();
    if (!r.ok) { setErr(j.error || "Nepodařilo se uložit."); return; }
    setRes(j); onSaved();
  }

  if (res) {
    return (
      <div className="sheet form">
        <h2>Díky, uloženo</h2>
        <p style={{ margin: 0 }}>
          Máš {res.score} bodů z {res.max}, to odpovídá pásmu „{res.band}“.{res.prev !== null ? ` Minule to bylo ${res.prev}.` : ""} Psycholog to s tebou probere. Není to diagnóza, jen orientační ukazatel.
        </p>
        {res.risk && (
          <>
            <p style={{ margin: 0 }}>Napsal/a jsi, že tě napadají myšlenky na smrt nebo ublížení sobě. Nejsi v tom sám/sama. Tvůj psycholog dostal upozornění.</p>
            <div className="hotline"><span className="label">Linka první psychické pomoci, nonstop</span><div className="big">116 123</div></div>
            <div className="hotline"><span className="label">Tísňová linka</span><div className="big">112</div></div>
          </>
        )}
        <button className="btn" onClick={onClose}>Hotovo</button>
      </div>
    );
  }

  return (
    <div className="sheet form">
      <div className="row"><h2>{def.title}</h2><span className="label">Poslední 2 týdny</span></div>
      <p className="note" style={{ margin: 0 }}>Jak často tě za poslední 2 týdny trápilo:</p>
      {def.items.map((item, i) => (
        <div className="q-item" key={i}>
          <b>{i + 1}. {item}</b>
          <div className="q-opts">
            {OPTIONS.map((o, v) => (
              <button key={v} type="button" aria-pressed={ans[i] === v} onClick={() => setAns((a) => a.map((x, k) => (k === i ? v : x)))}>{o}</button>
            ))}
          </div>
        </div>
      ))}
      {err && <p className="note" style={{ color: "var(--risk)", margin: 0 }}>{err}</p>}
      <button className="btn" disabled={busy || ans.includes(null)} onClick={save}>Uložit</button>
      <button className="btn ghost" onClick={onClose}>Zavřít</button>
    </div>
  );
}

/* ---------- příprava na sezení ---------- */
export function PrepCard({ client }: { client: Client }) {
  const [text, setText] = useState(client.prep ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(client.prep ? "Už odesláno. Můžeš to upravit a poslat znovu." : "");

  async function draft() {
    setBusy(true);
    const before = text;
    try {
      await streamInto(await post("/api/prep", { clientId: client.id, draft: true, text: before }), setText);
    } catch {
      setText(before); setStatus("Návrh se teď nepovedl.");
    }
    setBusy(false);
  }
  async function send() {
    const r = await post("/api/prep", { clientId: client.id, text });
    setStatus(r.ok ? "Odesláno. Psycholog to uvidí před sezením." : "Napiš aspoň jednu věc.");
  }
  return (
    <div className="card">
      <div className="row"><h3>Na příští sezení</h3><span className="label">{client.next_session}</span></div>
      <p className="note" style={{ margin: 0 }}>Co chceš probrat? Parťák ti pomůže to sepsat z tvého týdne.</p>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Např. jak proběhla porada, co mi pomohlo…" />
      <div className="sos">
        <button className="btn ghost" disabled={busy} onClick={draft}>{busy ? "Připravuji…" : "Pomoz mi připravit"}</button>
        <button className="btn" disabled={busy} onClick={send}>Poslat psychologovi</button>
      </div>
      {status && <span className="note">{status}</span>}
    </div>
  );
}

/* ---------- připomínky ---------- */
const TOASTS: Record<string, [string, string]> = {
  "Check-in": ["Jak se dnes máš?", "Check-in zabere 20 vteřin. Klepni sem."],
  "Deník myšlenek": ["Chceš si to zapsat?", "Úzkost byla dnes vyšší. Pár řádků do deníku pomůže."],
  "Procházka": ["Čas na procházku", "20 minut venku, ideálně bez telefonu."],
  "Příprava na sezení": ["Zítra máš sezení", "Chceš si sepsat, co probrat?"],
};

export function RemindersCard({ client, onToast }: { client: Client; onToast: (t: [string, string]) => void }) {
  const [rem, setRem] = useState(client.reminders ?? []);
  const update = (i: number, patch: Partial<(typeof rem)[number]>) => {
    const next = rem.map((r, k) => (k === i ? { ...r, ...patch } : r));
    setRem(next);
    post("/api/consent", { clientId: client.id, reminders: next }, "PUT");
  };
  return (
    <div className="card">
      <div className="row"><h3>Připomínky</h3><span className="label">Chytře, ne otravně</span></div>
      <div>
        {rem.map((r, i) => (
          <div className="opt" key={r.title}>
            <label htmlFor={`rem${i}`}>{r.title}</label>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/^\d\d:\d\d$/.test(r.when)
                ? <input type="time" value={r.when} onChange={(e) => update(i, { when: e.target.value })} />
                : <small className="note">{r.when}</small>}
              <input type="checkbox" id={`rem${i}`} checked={r.on} onChange={(e) => update(i, { on: e.target.checked })} />
            </span>
          </div>
        ))}
      </div>
      <span className="note">Nejvýš 2 připomínky denně. Když check-in vyplníš sám/sama, připomínka nepřijde.</span>
      <button className="btn ghost" onClick={() => {
        const r = rem.find((x) => x.on);
        onToast(r ? TOASTS[r.title] ?? [r.title, ""] : ["Připomínky jsou vypnuté", "Zapni si aspoň jednu."]);
      }}>Ukázat, jak připomínka vypadá</button>
    </div>
  );
}

export function Toast({ toast, onClose }: { toast: [string, string] | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <button type="button" className="toast" onClick={onClose}>
      <span className="label">Inbetween · teď</span>
      <b>{toast[0]}</b>
      <span>{toast[1]}</span>
    </button>
  );
}

/* ---------- soukromí a data ---------- */
export function PrivacyCard({ client, therapist }: { client: Client; therapist: string }) {
  const [share, setShare] = useState({ share_thoughts: client.share_thoughts, share_scores: client.share_scores, share_chat: client.share_chat });
  const [status, setStatus] = useState("");
  const toggle = (k: keyof typeof share, v: boolean) => {
    setShare((s) => ({ ...s, [k]: v }));
    post("/api/consent", { clientId: client.id, [k]: v }, "PUT");
  };
  return (
    <div className="card">
      <div className="row"><h3>Soukromí a data</h3><span className="label">Rozhoduješ ty</span></div>
      <div>
        <div className="opt"><span>Check-iny a krizová upozornění<br /><small className="note">Sdílí se vždy, jsou součástí terapie.</small></span><input type="checkbox" checked disabled /></div>
        <div className="opt"><label htmlFor="shT">{therapist} vidí deník myšlenek</label><input type="checkbox" id="shT" checked={share.share_thoughts} onChange={(e) => toggle("share_thoughts", e.target.checked)} /></div>
        <div className="opt"><label htmlFor="shS">{therapist} vidí výsledky dotazníků</label><input type="checkbox" id="shS" checked={share.share_scores} onChange={(e) => toggle("share_scores", e.target.checked)} /></div>
        <div className="opt"><label htmlFor="shC">{therapist} vidí celé znění chatu<br /><small className="note">Vypnuto: vidí jen shrnutí od AI.</small></label><input type="checkbox" id="shC" checked={share.share_chat} onChange={(e) => toggle("share_chat", e.target.checked)} /></div>
      </div>
      <p className="note" style={{ margin: 0 }}>Data jsou uložená v EU (Frankfurt) a šifrovaná. Nikomu je neprodáváme a AI se na nich neučí.</p>
      <div className="sos">
        <a className="btn ghost" style={{ textAlign: "center", textDecoration: "none" }} href={`/api/export?client=${client.id}`} download>Stáhnout moje data</a>
        <button className="btn ghost" onClick={() => setStatus("V ostré verzi smažeme účet a všechna data do 30 dní a psycholog dostane oznámení. V demu se nic nemaže.")}>Smazat účet</button>
      </div>
      {status && <span className="note">{status}</span>}
    </div>
  );
}

/* ---------- diktování (Web Speech API) ---------- */
type SR = { lang: string; interimResults: boolean; start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

export function MicButton({ value, onText, onStatus }: { value: string; onText: (t: string) => void; onStatus: (s: string) => void }) {
  const rec = useRef<SR | null>(null);
  const [on, setOn] = useState(false);
  function click() {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { onStatus("Diktování tenhle prohlížeč nepodporuje. Zkus Chrome nebo mobil."); return; }
    if (rec.current) { rec.current.stop(); return; }
    const r = new Ctor();
    const base = value;
    r.lang = "cs-CZ"; r.interimResults = true;
    r.onresult = (e) => onText((base ? base + " " : "") + Array.from(e.results).map((x) => x[0].transcript).join(""));
    r.onerror = (e) => onStatus(e.error === "not-allowed" ? "Mikrofon není povolený." : "Diktování se nepovedlo, zkus to znovu.");
    r.onend = () => { rec.current = null; setOn(false); onStatus(""); };
    rec.current = r;
    try { r.start(); setOn(true); onStatus("Poslouchám… klepni znovu pro konec."); } catch { rec.current = null; onStatus("Mikrofon není povolený."); }
  }
  return (
    <button type="button" className="btn ghost mic" aria-pressed={on} onClick={click} title="Nadiktovat zprávu" aria-label="Nadiktovat zprávu">🎙</button>
  );
}


/* ---------- týdenní přehled ---------- */
export function WeekCard({ clientId, checkins, tasks, thoughts }: {
  clientId: string; checkins: { anxiety: number }[]; tasks: { week_done: number }[]; thoughts: { intensity_before: number; intensity_after: number | null }[];
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const practice = tasks.reduce((n, t) => n + t.week_done, 0);
  const done = thoughts.filter((t) => t.intensity_after !== null);
  const drop = done.length ? Math.round(done.reduce((a, t) => a + (t.intensity_before - (t.intensity_after ?? 0)), 0) / done.length) : 0;
  const first = checkins[0], last = checkins.at(-1);
  async function summarize() {
    setBusy(true);
    try { await streamInto(await post("/api/week", { clientId }), setText); } catch { setText("Shrnutí se teď nepovedlo."); }
    setBusy(false);
  }
  return (
    <div className="card">
      <div className="row"><h3>Tvůj týden</h3><span className="label">Od minulého sezení</span></div>
      <div className="week">
        <div><b>{checkins.length}×</b><small>check-in</small></div>
        <div><b>{practice}×</b><small>procvičení technik</small></div>
        <div><b>{first && last ? `${first.anxiety} → ${last.anxiety}` : "–"}</b><small>úzkost (0–10)</small></div>
      </div>
      <p style={{ margin: 0, fontSize: 14 }}>
        {text || (done.length ? `Do deníku jsi zapsal/a ${thoughts.length}× a emoce pak v průměru klesla o ${drop} %. To je přesně ta práce, která pomáhá.` : "Každý check-in a každé cvičení se počítá.")}
      </p>
      <button className="btn ghost" disabled={busy} onClick={summarize}>{busy ? "Píšu…" : text ? "Shrň znovu" : "Shrň mi týden"}</button>
    </div>
  );
}
