"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Client, Checkin, Message, Outreach, Score, Task, ThoughtRecord } from "@/lib/db";
import type { QKind } from "@/lib/questionnaires";
import { MicButton, OutreachCard, WeekCard, PrepCard, PrivacyCard, QuestionnaireSheet, QuestionnairesCard, RemindersCard, Toast } from "./extras";
import { getTechnique, splitSources, CRISIS_TECHNIQUE_ID } from "@/lib/techniques";

const CLIENT_ID = "petra"; // demo: jeden přihlášený klient
const CRISIS_TAG = "[KRIZE]";
const MOODS: [number, string][] = [[1, "Hrozně"], [2, "Špatně"], [3, "Jde to"], [4, "Dobře"], [5, "Skvěle"]];
const SUGGESTIONS = ["Zítra mám poradu a jsem z toho na nervy", "Nemůžu usnout", "Mám si zvýšit dávku léků?"];

type State = { client: Client; checkins: Checkin[]; tasks: Task[]; messages: Message[]; scores: Score[]; outreach: Outreach[]; thoughts: ThoughtRecord[] };
type ChatMsg = { role: "user" | "assistant"; content: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const post = (url: string, body: unknown, method = "POST") =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function KlientPage() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"home" | "chat" | "plan">("home");
  const [toast, setToast] = useState<[string, string] | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/state?client=${CLIENT_ID}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Nepodařilo se načíst data. Běží databáze a je nastavená DATABASE_URL?");
    const data = await res.json();
    setState(data);
    return data as State;
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  if (error) return <main className="landing"><p className="err">{error}</p></main>;
  if (!state) return <main className="landing"><p className="note">Načítám…</p></main>;

  const therapistFirst = state.client.therapist.split(" ").at(-2) ?? state.client.therapist;

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1><Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Inbetween</Link></h1>
          <span className="tag">Aplikace klienta</span>
        </div>
        <Link className="note" href="/psycholog">Přejít na pohled psychologa</Link>
      </header>
      <main className="stage-single">
        <div className="phone">
          <div className="screen">
            <div className="scr-head">
              <span className="label">{new Date().toLocaleDateString("cs-CZ", { weekday: "long" })}</span>
              <h2>Ahoj {state.client.salutation}</h2>
            </div>

            {tab === "home" && (
              <Home state={state} therapistFirst={therapistFirst} reload={load} openChat={() => setTab("chat")} />
            )}
            {tab === "chat" && <Chat initial={state.messages} />}
            {tab === "plan" && (
              <div className="scr-body">
                <div className="card">
                  <h3>Můj plán</h3>
                  <p className="note" style={{ margin: 0 }}>Plán nastavil tvůj psycholog. Parťák se ho drží a nic v něm nemění.</p>
                  <div style={{ whiteSpace: "pre-wrap" }}>{state.client.plan}</div>
                </div>
                <div className="card">
                  <h3>Moje techniky</h3>
                  <p className="note" style={{ margin: 0 }}>Vybral je tvůj psycholog z knihovny ověřených postupů.</p>
                  {(state.client.allowed_techniques ?? []).map(getTechnique).filter((t) => !!t).map((t) => (
                    <div className="task" key={t!.id}>
                      <div>
                        <b>{t!.title}</b>
                        <small>{t!.steps}</small>
                        <small><a href={t!.source.url} target="_blank" rel="noreferrer">Zdroj: {t!.source.name}</a></small>
                      </div>
                    </div>
                  ))}
                </div>
                <PrepCard client={state.client} />
                <RemindersCard client={state.client} onToast={setToast} />
                <PrivacyCard client={state.client} therapist={therapistFirst} />
                <Hotlines />
              </div>
            )}
            <Toast toast={toast} onClose={closeToast} />

            <nav className="tabs" role="tablist">
              {([["home", "Dnes"], ["chat", "Parťák"], ["plan", "Plán"]] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); if (k !== "chat") load(); }}>
                  {l}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </main>
    </div>
  );
}

function Hotlines() {
  return (
    <div className="card">
      <h3>Když je nejhůř</h3>
      <div className="hotline"><span className="label">Linka první psychické pomoci, nonstop</span><div className="big">116 123</div></div>
      <div className="hotline"><span className="label">Tísňová linka</span><div className="big">112</div></div>
    </div>
  );
}

function Home({ state, therapistFirst, reload, openChat }: {
  state: State; therapistFirst: string; reload: () => Promise<State>; openChat: () => void;
}) {
  const [mood, setMood] = useState<number | null>(null);
  const [anx, setAnx] = useState(5);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<null | number>(null);
  const [sheet, setSheet] = useState<null | "breath" | "sos" | "thought">(null);
  const [qKind, setQKind] = useState<QKind | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveCheckin() {
    if (!mood) return;
    setBusy(true);
    await post("/api/checkins", { clientId: CLIENT_ID, mood, anxiety: anx, note });
    setSaved(anx);
    setBusy(false);
    reload();
  }

  async function toggleTask(t: Task, done: boolean) {
    await post(`/api/tasks/${t.id}`, { done }, "PATCH");
    reload();
  }

  return (
    <>
      <div className="scr-body">
        <OutreachCard outreach={state.outreach ?? []} therapist={therapistFirst} />

        <div className="card next">
          <span className="label">Příští sezení</span>
          <b>{state.client.next_session} · {state.client.therapist}</b>
          <span className="note">Do té doby jsem tu pro tebe podle plánu, který jste spolu nastavili.</span>
        </div>

        <WeekCard clientId={CLIENT_ID} checkins={state.checkins} tasks={state.tasks} thoughts={state.thoughts ?? []} />

        <div className="card">
          {saved === null ? (
            <>
              <div className="row"><h3>Jak se dnes máš?</h3><span className="label">Check-in</span></div>
              <div className="moods">
                {MOODS.map(([v, l]) => (
                  <button key={v} aria-pressed={mood === v} onClick={() => setMood(v)}><b>{v}</b><span>{l}</span></button>
                ))}
              </div>
              <div>
                <div className="row"><label htmlFor="anx">Úzkost</label><b>{anx} / 10</b></div>
                <input type="range" id="anx" min={0} max={10} value={anx} onChange={(e) => setAnx(Number(e.target.value))} />
              </div>
              <input type="text" id="ciNote" placeholder="Co se dnes stalo? (nepovinné)" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn" disabled={!mood || busy} onClick={saveCheckin}>Uložit check-in</button>
            </>
          ) : (
            <>
              <h3>Díky, check-in je uložený</h3>
              <p className="note" style={{ margin: 0 }}>
                {saved >= 6
                  ? "Úzkost je dnes vyšší. Chceš zkusit dýchání 4-4-6 nebo si o tom napsat s parťákem?"
                  : `${therapistFirst} to uvidí před příštím sezením.`}
              </p>
              <button className="btn ghost" onClick={openChat}>Napsat parťákovi</button>
            </>
          )}
        </div>

        <div className="card">
          <div className="row"><h3>Úkoly z terapie</h3><span className="label">Tento týden</span></div>
          <div>
            {state.tasks.map((t) => (
              <label className="task" key={t.id}>
                <input type="checkbox" id={`task-${t.id}`} checked={t.done_today} onChange={(e) => toggleTask(t, e.target.checked)} />
                <div><b>{t.title}</b><small>{t.hint} Tento týden {t.week_done}/{t.week_goal}.</small></div>
                {/^deník myšlenek/i.test(t.title) && (
                  <button className="btn ghost sm" onClick={(e) => { e.preventDefault(); setSheet("thought"); }}>Vyplnit</button>
                )}
              </label>
            ))}
          </div>
        </div>

        <QuestionnairesCard scores={state.scores ?? []} onOpen={setQKind} />

        <div className="card">
          <h3>Potřebuješ to teď?</h3>
          <div className="sos">
            <button className="btn ghost" onClick={() => { setSheet("breath"); post("/api/sos", { clientId: CLIENT_ID, kind: "breathing" }); }}>Zklidnit dech</button>
            <button className="btn risk" onClick={() => { setSheet("sos"); post("/api/sos", { clientId: CLIENT_ID, kind: "sos" }); }}>Potřebuji pomoc hned</button>
          </div>
        </div>
      </div>

      {sheet === "breath" && <Breathing onClose={() => setSheet(null)} />}
      {sheet === "thought" && <ThoughtForm onClose={() => setSheet(null)} onSaved={reload} />}
      {qKind && <QuestionnaireSheet key={qKind} kind={qKind} clientId={CLIENT_ID} onClose={() => setQKind(null)} onSaved={reload} />}
      {sheet === "sos" && (
        <div className="sheet">
          <h2>Nejsi v tom sám/sama</h2>
          <p style={{ margin: 0 }}>Pokud jsi v ohrožení, zavolej hned. Tvůj psycholog dostal upozornění a ozve se ti.</p>
          <div className="hotline"><span className="label">Linka první psychické pomoci, nonstop</span><div className="big">116 123</div></div>
          <div className="hotline"><span className="label">Tísňová linka</span><div className="big">112</div></div>
          <button className="btn ghost" onClick={() => setSheet(null)}>Zpět</button>
        </div>
      )}
    </>
  );
}

function ThoughtForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ situation: "", thought: "", emotion: "", before: 70, balanced: "", after: 40 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: k === "before" || k === "after" ? Number(e.target.value) : e.target.value });

  async function save() {
    setBusy(true); setErr("");
    const r = await post("/api/thoughts", {
      clientId: CLIENT_ID, situation: f.situation, thought: f.thought, emotion: f.emotion,
      intensityBefore: f.before, balanced: f.balanced, intensityAfter: f.after,
    });
    setBusy(false);
    if (!r.ok) { setErr((await r.json()).error || "Nepodařilo se uložit."); return; }
    setStep(2); onSaved();
  }

  return (
    <div className="sheet form">
      <div className="row"><h2>Deník myšlenek</h2><span className="label">{step < 2 ? `Krok ${step + 1} ze 2` : "Hotovo"}</span></div>
      {step === 0 && (
        <>
          <label>Situace<small>Co se stalo? Kde, kdy, s kým.</small>
            <textarea rows={2} value={f.situation} onChange={set("situation")} placeholder="Šéf mi na poradě skočil do řeči." /></label>
          <label>Automatická myšlenka<small>Co ti v tu chvíli proběhlo hlavou?</small>
            <textarea rows={2} value={f.thought} onChange={set("thought")} placeholder="Myslí si, že jsem neschopná." /></label>
          <label>Emoce<small>Jedním slovem: strach, stud, vztek, smutek…</small>
            <input type="text" value={f.emotion} onChange={set("emotion")} placeholder="stud" /></label>
          <label><span className="row">Jak silná byla <b>{f.before} %</b></span>
            <input type="range" min={0} max={100} step={5} value={f.before} onChange={set("before")} /></label>
          <button className="btn" disabled={!f.situation.trim() || !f.thought.trim() || !f.emotion.trim()} onClick={() => setStep(1)}>Dál</button>
        </>
      )}
      {step === 1 && (
        <>
          <p className="note" style={{ margin: 0 }}>Zkus se na myšlenku „{f.thought}“ podívat zvenku. Co ji podporuje a co ji vyvrací? Co bys řekl/a kamarádovi, kdyby ji měl on?</p>
          <label>Vyváženější pohled<small>Nemusí být pozitivní, jen realističtější.</small>
            <textarea rows={3} value={f.balanced} onChange={set("balanced")} placeholder="Skočil do řeči i ostatním. Na minulé poradě můj návrh pochválil." /></label>
          <label><span className="row">Jak silná je emoce teď <b>{f.after} %</b></span>
            <input type="range" min={0} max={100} step={5} value={f.after} onChange={set("after")} /></label>
          {err && <p className="note" style={{ color: "var(--risk)", margin: 0 }}>{err}</p>}
          <div className="sos">
            <button className="btn ghost" onClick={() => setStep(0)}>Zpět</button>
            <button className="btn" disabled={busy} onClick={save}>Uložit záznam</button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <p style={{ margin: 0 }}>Uloženo. {f.balanced && f.after < f.before ? `Emoce klesla z ${f.before} % na ${f.after} %. ` : ""}Záznam uvidí tvůj psycholog a probere ho s tebou na sezení.</p>
          <button className="btn" onClick={onClose}>Hotovo</button>
        </>
      )}
      {step < 2 && <button className="btn ghost" onClick={onClose}>Zavřít</button>}
    </div>
  );
}

function Breathing({ onClose }: { onClose: () => void }) {
  const [word, setWord] = useState("Připrav se");
  const [scale, setScale] = useState(0.6);
  const [dur, setDur] = useState(4);
  const [round, setRound] = useState("Tři klidná kola. Technika z tvého plánu.");

  useEffect(() => {
    let alive = true;
    (async () => {
      await sleep(600);
      const steps: [string, number, number][] = [["Nádech", 4, 1], ["Zadrž", 4, 1], ["Výdech", 6, 0.6]];
      for (let k = 0; k < 3; k++) {
        for (const [w, s, sc] of steps) {
          if (!alive) return;
          setDur(s); setScale(sc); setWord(w); setRound(`Kolo ${k + 1} ze 3`);
          await sleep(s * 1000);
        }
      }
      if (alive) { setWord("Hotovo"); setRound("Jak je ti teď? Můžeš to napsat parťákovi."); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="sheet">
      <h2>Dýchání 4-4-6</h2>
      <div className="breath" style={{ transform: `scale(${scale})`, transitionDuration: `${dur}s` }}>{word}</div>
      <p className="note">{round}</p>
      <button className="btn ghost" onClick={onClose}>Zavřít</button>
    </div>
  );
}

function Chat({ initial }: { initial: Message[] }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial.map((m) => ({ role: m.role, content: m.content })));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [micStatus, setMicStatus] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [msgs]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: t }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: CLIENT_ID, text: t }),
      });
      if (!res.ok || !res.body) throw new Error();
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: acc }]);
      }
    } catch {
      setMsgs((m) => [...m.slice(0, -1), {
        role: "assistant",
        content: "Spojení se nepodařilo. Jestli je ti hodně zle, zavolej Linku první psychické pomoci 116 123 nebo 112.",
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="scr-body" ref={bodyRef}>
        <div className="chat" aria-live="polite">
          {msgs.map((m, i) => {
            const crisis = m.role === "assistant" && m.content.trimStart().startsWith(CRISIS_TAG);
            const parsed = m.role === "assistant" ? splitSources(m.content) : { text: m.content, ids: [] };
            const text = parsed.text.replace(CRISIS_TAG, "").trim();
            const used = parsed.ids.filter((id) => id !== CRISIS_TECHNIQUE_ID).map(getTechnique).filter((t) => !!t);
            return (
              <div key={i} className={`msg ${m.role === "user" ? "me" : "ai"}${crisis ? " crisis" : ""}`}>
                {text || (m.role === "assistant" ? "Píšu…" : "")}
                {crisis && (
                  <div style={{ marginTop: 8 }}>
                    <div className="label">Linka první psychické pomoci, nonstop</div><div className="num">116 123</div>
                    <div className="label" style={{ marginTop: 4 }}>Tísňová linka</div><div className="num">112</div>
                  </div>
                )}
                {used.length > 0 && (
                  <div className="sources">
                    {used.map((t) => (
                      <a key={t!.id} href={t!.source.url} target="_blank" rel="noreferrer" title={t!.source.name}>
                        {t!.title} · zdroj: {t!.source.name.split(":")[0]}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {msgs.filter((m) => m.role === "user").length === 0 && (
          <div className="chips">
            {SUGGESTIONS.map((s) => <button key={s} className="chip" type="button" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
      </div>
      {micStatus && <span className="ai-status" style={{ padding: "0 14px" }}>{micStatus}</span>}
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <MicButton value={input} onText={setInput} onStatus={setMicStatus} />
        <input type="text" id="chatIn" placeholder="Napiš nebo nadiktuj, co se děje…" autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn" disabled={busy}>Poslat</button>
      </form>
    </>
  );
}
