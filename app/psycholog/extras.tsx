"use client";

// Doplňky přehledu psychologa: dotazníky, příprava klienta, zpráva navržená AI, čekárna.
import { useEffect, useState } from "react";
import type { Client, Outreach, Score, WaitPerson } from "@/lib/db";
import { QUESTIONNAIRES, band, type QKind } from "@/lib/questionnaires";

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

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
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });

export function consentLine(c: Client) {
  const parts = ["check-iny"];
  if (c.share_thoughts) parts.push("deník");
  if (c.share_scores) parts.push("dotazníky");
  parts.push(c.share_chat ? "celé znění chatu" : "jen shrnutí chatu");
  return `Klient sdílí: ${parts.join(", ")}.`;
}

function Bars({ scores, kind }: { scores: Score[]; kind: QKind }) {
  const def = QUESTIONNAIRES[kind];
  const list = scores.filter((s) => s.kind === kind);
  if (!list.length) return null;
  return (
    <div className="bars">
      {list.map((s) => {
        const b = band(kind, s.score);
        return (
          <div className="bar" key={s.id} title={b.label}>
            <span>{def.name} · {fmtDay(s.created_at)}</span>
            <div><i className={b.tone} style={{ width: `${Math.max(4, (s.score / def.max) * 100)}%` }} /></div>
            <b>{s.score}</b>
          </div>
        );
      })}
    </div>
  );
}

export function ScoresBox({ client, scores }: { client: Client; scores: Score[] }) {
  const trend = (k: QKind) => {
    const l = scores.filter((s) => s.kind === k);
    if (l.length < 2) return null;
    const d = l.at(-1)!.score - l[0].score;
    return `${QUESTIONNAIRES[k].name} ${d < 0 ? `kleslo o ${-d}` : d > 0 ? `stouplo o ${d}` : "beze změny"} (${band(k, l.at(-1)!.score).label}).`;
  };
  return (
    <div className="box">
      <div className="row"><h3>Dotazníky</h3><span className="label">GAD-7 · PHQ-9</span></div>
      {!client.share_scores ? <span className="empty">Klient výsledky dotazníků nesdílí.</span>
        : !scores.length ? <span className="empty">Zatím nevyplněno.</span>
        : (
          <>
            <Bars scores={scores} kind="gad7" />
            <Bars scores={scores} kind="phq9" />
            <span className="note">{[trend("gad7"), trend("phq9")].filter(Boolean).join(" ")}</span>
          </>
        )}
      <div className="decide">Orientační screening, ne diagnóza. GAD-7: Spitzer a kol. 2006, PHQ-9: Kroenke a kol. 2001, volně k použití.</div>
    </div>
  );
}

export function PrepBox({ client }: { client: Client }) {
  return (
    <div className="box">
      <div className="row"><h3>Klient chce probrat</h3><span className="label">Příprava na sezení</span></div>
      {client.prep
        ? client.prep.split("\n").filter(Boolean).map((l, i) => <p key={i} style={{ margin: "2px 0" }}>{l}</p>)
        : <span className="empty">Zatím nic neposlal. Píše to na záložce Plán.</span>}
    </div>
  );
}

export function OutreachBox({ client, outreach, reload }: { client: Client; outreach: Outreach[]; reload: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function draft() {
    setBusy(true); setStatus("");
    try { await streamInto(await post("/api/outreach", { clientId: client.id, draft: true }), setText); }
    catch { setStatus("Návrh se teď nepovedl."); }
    setBusy(false);
  }
  async function send() {
    const r = await post("/api/outreach", { clientId: client.id, text });
    if (r.ok) { setStatus(`Odesláno ${new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}. Klient ji uvidí v aplikaci.`); setText(""); reload(); }
    else setStatus("Nejdřív zprávu napište nebo nechte navrhnout.");
  }
  const last = outreach.at(-1);
  return (
    <div className="box">
      <div className="row"><h3>Zpráva pro klienta</h3><button className="btn" disabled={busy} onClick={draft}>{busy ? "Připravuji…" : text ? "Navrhnout znovu" : "Navrhnout zprávu"}</button></div>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="AI navrhne krátkou zprávu podle plánu a posledních dní. Vy ji upravíte a odešlete." />
      <div className="row">
        <span className="note">{status || (last ? `Naposledy posláno ${fmtDay(last.created_at)}.` : "Klient ji uvidí jako zprávu od vás, ne od AI.")}</span>
        <button className="btn ghost" disabled={busy || !text.trim()} onClick={send}>Odeslat</button>
      </div>
      <div className="decide">AI navrhuje, psycholog rozhoduje. Bez vašeho odeslání se klientovi nic nepošle.</div>
    </div>
  );
}

function Mini({ md }: { md: string }) {
  return <>{md.split("\n").filter((l) => l.trim()).map((l, i) => <p key={i} style={{ margin: "2px 0" }}>{l.replace(/\*\*/g, "")}</p>)}</>;
}

export function WaitlistView({ client }: { client: Client }) {
  const [people, setPeople] = useState<WaitPerson[]>([]);
  const [triage, setTriage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/waitlist", { cache: "no-store" }).then((r) => r.json()).then((j) => setPeople(j.people ?? [])); }, []);
  async function suggest() {
    setBusy(true);
    try { await streamInto(await post("/api/waitlist", {}), setTriage); } catch { setTriage("Návrh se teď nepovedl."); }
    setBusy(false);
  }
  return (
    <div className="main">
      <div className="main-head">
        <div><span className="label">{client.focus}</span><h2>Čekárna</h2></div>
        <span className="note">{people.length} lidé · nejdéle {Math.max(0, ...people.map((p) => p.weeks))} týdnů</span>
      </div>
      <div className="box">
        <h3>Co dostávají, než přijdou na řadu</h3>
        <p className="note" style={{ margin: 0 }}>Vstupní dotazník GAD-7 a PHQ-9, týdenní check-in, 6 krátkých modulů (dech, spánek, starosti, pohyb, laskavost k sobě, kdy hledat pomoc) a krizové linky. Nikdo nečeká úplně sám a vy máte před prvním sezením vstupní přehled.</p>
      </div>
      <div className="box">
        <div className="row"><h3>Pořadí</h3><button className="btn" disabled={busy} onClick={suggest}>{busy ? "Připravuji…" : triage ? "Navrhnout znovu" : "Navrhnout pořadí"}</button></div>
        <div style={{ overflowX: "auto" }}>
          <table className="wl">
            <thead><tr><th>Klient</th><th>Čeká</th><th>GAD-7</th><th>PHQ-9</th><th>Program</th><th>Stav</th></tr></thead>
            <tbody>
              {people.map((p) => {
                const tone = p.item9 ? "risk" : p.gad7 >= 10 || p.phq9 >= 10 ? "warn" : "ok";
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td><td>{p.weeks} týd.</td><td>{p.gad7}</td><td>{p.phq9}</td><td>{p.modules_done}/6</td>
                    <td>
                      <span className={`pill ${tone}`}>{p.item9 ? "Kontaktovat dnes" : tone === "warn" ? "Sledovat" : "Stabilní"}</span>
                      {p.note && <small className="note" style={{ display: "block" }}>{p.note}</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {triage && <div className="summary"><Mini md={triage} /></div>}
        <div className="decide">Pořadí určuje psycholog. Kladná odpověď na otázku 9 (myšlenky na smrt) se hlásí hned a nečeká na AI.</div>
      </div>
    </div>
  );
}
