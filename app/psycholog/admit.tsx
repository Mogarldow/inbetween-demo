"use client";

import { useState } from "react";

/** Formulář: nový klient, nebo přijetí člověka z čekárny do péče. */
export function ClientForm({ waitId, initialName = "", initialFocus = "", fromApp, onDone, onCancel }: {
  waitId?: number; initialName?: string; initialFocus?: string; fromApp?: boolean;
  onDone: (id: string) => void; onCancel?: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [salutation, setSalutation] = useState("");
  const [focus, setFocus] = useState(initialFocus);
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/clients", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, salutation, focus, next_session: next, waitId }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Uložení se nepovedlo.");
    onDone(j.id);
  };
  return (
    <div className="box mat-form">
      <h3>{waitId ? `Přijmout do péče: ${initialName}` : "Nový klient"}</h3>
      {fromApp && <p className="note" style={{ margin: 0 }}>Už používá Inbetween bez psychologa. Zůstanou mu check-iny, deník i dotazníky a od teď uvidí váš plán.</p>}
      <div className="form-grid">
        <label>Jméno<input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Např. Jana N." disabled={!!fromApp} /></label>
        <label>Oslovení v aplikaci<input type="text" value={salutation} onChange={(e) => setSalutation(e.target.value)} placeholder="Např. Jano" /></label>
        <label>Téma<input type="text" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Např. Úzkost, spánek" /></label>
        <label>První sezení<input type="text" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Např. Úterý 15:00" /></label>
      </div>
      {err && <p className="err" style={{ margin: 0 }}>{err}</p>}
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        {onCancel && <button className="btn ghost" onClick={onCancel}>Zrušit</button>}
        <button className="btn" disabled={busy || !name.trim()} onClick={save}>{busy ? "Ukládám…" : waitId ? "Přijmout do péče" : "Přidat klienta"}</button>
      </div>
    </div>
  );
}

/** Stránka „Nový klient“: po přidání ukáže pozvánku do aplikace. */
export function NewClientView({ onCreated }: { onCreated: (id: string) => void }) {
  const [created, setCreated] = useState<string | null>(null);
  const link = created ? `${typeof window !== "undefined" ? window.location.origin : ""}/klient?id=${created}` : "";
  return (
    <div className="main">
      <div className="main-head">
        <div><span className="label">Moji klienti</span><h2>Nový klient</h2></div>
      </div>
      {!created ? (
        <ClientForm key="new" onDone={setCreated} />
      ) : (
        <div className="box">
          <h3>Klient je přidaný</h3>
          <p className="note" style={{ margin: 0 }}>Pošlete mu pozvánku do aplikace. Po otevření uvidí váš plán a parťák se jím bude řídit. Plán a materiály na tento týden nastavíte v jeho detailu.</p>
          <input type="text" readOnly value={link} onFocus={(e) => e.target.select()} />
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(link)}>Zkopírovat odkaz</button>
            <a className="btn ghost" href={link} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Otevřít jako klient</a>
            <button className="btn" onClick={() => onCreated(created)}>Otevřít detail klienta</button>
          </div>
        </div>
      )}
    </div>
  );
}
