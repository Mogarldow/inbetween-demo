"use client";

import { useCallback, useEffect, useState } from "react";
import { KIND_LABEL, type Material } from "@/lib/materials";

type Item = Material & { used: number };
const KINDS: Material["kind"][] = ["ukol", "kbt", "technika", "poznamka"];
const KIND_HINT: Record<Material["kind"], string> = {
  ukol: "Objeví se klientovi v seznamu úkolů s týdenním cílem.",
  kbt: "Cvičení s postupem, které klient najde v plánu a parťák ho jím provede.",
  technika: "Vlastní technika navíc ke knihovně ověřených technik.",
  poznamka: "Vzkaz od vás, klient ho uvidí v plánu na tento týden.",
};
const send = (url: string, body: unknown, method = "POST") =>
  fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function useLibrary() {
  const [items, setItems] = useState<Item[] | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/materials", { cache: "no-store" }).then((r) => r.json());
    setItems(r.items ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);
  return { items, load };
}

function MaterialForm({ initial, onDone, onCancel }: { initial?: Partial<Material>; onDone: (m?: Material) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<Material["kind"]>(initial?.kind ?? "ukol");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [goal, setGoal] = useState(initial?.week_goal || 3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true); setErr("");
    const r = await send("/api/materials", { id: initial?.id, kind, title, body, week_goal: goal }, initial?.id ? "PUT" : "POST");
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Uložení se nepovedlo.");
    onDone(j.item);
  };
  return (
    <div className="box mat-form">
      <div className="chips-pick">
        {KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
        ))}
      </div>
      <p className="note" style={{ margin: 0 }}>{KIND_HINT[kind]}</p>
      <input type="text" placeholder="Název, např. Jedna věta na poradě" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea rows={4} placeholder={kind === "poznamka" ? "Text vzkazu pro klienta" : "Postup nebo zadání pro klienta"} value={body} onChange={(e) => setBody(e.target.value)} />
      {kind === "ukol" && (
        <label className="note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          Cíl za týden
          <input type="number" min={1} max={14} value={goal} onChange={(e) => setGoal(Number(e.target.value))} style={{ width: 70 }} />
          ×
        </label>
      )}
      {err && <p className="err" style={{ margin: 0 }}>{err}</p>}
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button className="btn ghost" onClick={onCancel}>Zrušit</button>
        <button className="btn" disabled={busy || !title.trim()} onClick={save}>{initial?.id ? "Uložit změny" : "Přidat do knihovny"}</button>
      </div>
    </div>
  );
}

/** V detailu klienta: výběr z knihovny na tento týden. */
export function WeekPicker({ clientId, firstName, assigned, onSaved }: { clientId: string; firstName: string; assigned: Material[]; onSaved: () => void }) {
  const { items, load } = useLibrary();
  const [sel, setSel] = useState<number[]>(assigned.map((m) => m.id));
  const [state, setState] = useState<"" | "dirty" | "saving" | "saved">("");
  const [adding, setAdding] = useState(false);
  const toggle = (id: number, on: boolean) => { setSel((s) => (on ? [...s, id] : s.filter((x) => x !== id))); setState("dirty"); };
  const save = async () => {
    setState("saving");
    await send("/api/materials/assign", { clientId, materialIds: sel }, "PUT");
    setState("saved");
    onSaved();
  };
  return (
    <div className="box">
      <div className="row"><h3>Na tento týden pro klienta</h3><span className="label">Z vaší knihovny</span></div>
      <p className="note" style={{ margin: 0 }}>Zaškrtněte, co {firstName} tento týden dostane. Úkoly se objeví v seznamu úkolů, KBT cvičení, techniky a poznámky v plánu. Parťák je zná a pomůže s nimi, ale nic nepřidá.</p>
      {!items ? <p className="empty">Načítám knihovnu…</p> : KINDS.map((k) => {
        const list = items.filter((i) => i.kind === k);
        if (!list.length) return null;
        return (
          <div key={k}>
            <b className="mat-kind">{KIND_LABEL[k]}</b>
            <div className="tech-grid">
              {list.map((m) => (
                <label className="tech" key={m.id}>
                  <input type="checkbox" checked={sel.includes(m.id)} onChange={(e) => toggle(m.id, e.target.checked)} />
                  <span>{m.title}<small>{m.kind === "ukol" ? `${m.week_goal}× týdně · ` : ""}{m.body.slice(0, 70)}{m.body.length > 70 ? "…" : ""}</small></span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {adding ? (
        <MaterialForm onCancel={() => setAdding(false)} onDone={(m) => { setAdding(false); load(); if (m) toggle(m.id, true); }} />
      ) : (
        <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(true)}>+ Nový materiál</button>
      )}
      <div className="row">
        <span className="note">{state === "saved" ? `Odesláno. ${firstName} to vidí v aplikaci.` : `Vybráno ${sel.length}.`}</span>
        <button className="btn" disabled={state !== "dirty"} onClick={save}>{state === "saving" ? "Ukládám…" : "Uložit a poslat klientovi"}</button>
      </div>
    </div>
  );
}

/** Samostatná stránka knihovny psychologa. */
export function LibraryView() {
  const { items, load } = useLibrary();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const del = async (m: Item) => {
    if (m.used && !window.confirm(`„${m.title}“ má přiřazené ${m.used} klient(i). Smazat i u nich?`)) return;
    await fetch(`/api/materials?id=${m.id}`, { method: "DELETE" });
    load();
  };
  return (
    <div className="main">
      <div className="main-head">
        <div>
          <span className="label">Jen pro vás</span>
          <h2>Moje knihovna</h2>
          <p className="note" style={{ margin: 0 }}>Vlastní úkoly, KBT cvičení, techniky a poznámky. U každého klienta pak vyberete, co dostane na tento týden.</p>
        </div>
        {editing !== "new" && <button className="btn" onClick={() => setEditing("new")}>+ Nový materiál</button>}
      </div>
      {editing === "new" && <MaterialForm onCancel={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />}
      {!items ? <p className="empty">Načítám…</p> : KINDS.map((k) => {
        const list = items.filter((i) => i.kind === k);
        return (
          <div className="box" key={k}>
            <div className="row"><h3>{KIND_LABEL[k]}</h3><span className="note">{list.length}</span></div>
            {!list.length && <p className="empty" style={{ margin: 0 }}>Zatím nic.</p>}
            {list.map((m) => editing === m.id ? (
              <MaterialForm key={m.id} initial={m} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} />
            ) : (
              <div className="mat" key={m.id}>
                <div>
                  <b>{m.title}</b>{m.kind === "ukol" && <span className="note"> · {m.week_goal}× týdně</span>}
                  <p>{m.body}</p>
                  <small className="note">{m.used ? `Přiřazeno: ${m.used}` : "Zatím nikomu"}</small>
                </div>
                <div className="mat-actions">
                  <button className="btn ghost sm" onClick={() => setEditing(m.id)}>Upravit</button>
                  <button className="btn ghost sm" onClick={() => del(m)}>Smazat</button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
