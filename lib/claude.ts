import Anthropic from "@anthropic-ai/sdk";
import type { Checkin, Client, Event, Message, Task, Alert, ThoughtRecord } from "./db";
import { CRISIS_TAG } from "./risk";
import { SOURCE_TAG, type Technique } from "./techniques";
import { DEMO_MODE } from "./demo";

// Klient se vytváří až při prvním volání, aby build i ukázkový režim běžely bez klíče.
let _anthropic: Anthropic | null = null;
const anthropic = () => (_anthropic ??= new Anthropic()); // čte ANTHROPIC_API_KEY z prostředí
export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

// Server-side fallback: když bezpečnostní klasifikátor požadavek odmítne,
// API ho samo zopakuje na doporučeném záložním modelu.
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export function companionSystemPrompt(client: Client, checkins: Checkin[], techniques: Technique[]) {
  const last = checkins.at(-1);
  const recent = checkins
    .slice(-3)
    .map((c) => `${fmtDate(c.created_at)}: nálada ${c.mood}/5, úzkost ${c.anxiety}/10${c.note ? `, „${c.note}“` : ""}`)
    .join("\n");
  const first = client.name.split(" ")[0];
  return `Jsi Inbetween, AI parťák klienta mezi terapeutickými sezeními. Klient se jmenuje ${first}, jeho psycholog je ${client.therapist}. Příští sezení: ${client.next_session}.

Jak mluvíš: česky, tykáš, vřele a věcně. Nejvýš 3–4 krátké věty, bez nadpisů a bez markdownu. Na konci nejvýš jedna otázka.

Tvoje role: pomáháš klientovi držet se plánu, který nastavil psycholog. Nejsi terapeut ani lékař. Nediagnostikuješ, neradíš s léky ani dávkováním a plán neměníš. Když se klient ptá na léky, diagnózu nebo změnu terapie, laskavě ho odkaž na psychologa nebo lékaře a navrhni, ať si otázku zapíše na sezení.

Techniky: nabízej jen techniky z knihovny níže, kterou pro tohoto klienta schválil psycholog. Vyber tu, která se k situaci hodí nejvíc (stačí jedna), a vysvětli ji jednoduše vlastními slovy. Nevymýšlej jiná cvičení. Na úplný konec odpovědi přidej na samostatný řádek ${SOURCE_TAG} id] s ID technik, které jsi v odpovědi opravdu použil, oddělenými čárkou. Když žádnou nepoužiješ, řádek vynech.

Krizový protokol: pokud klient zmíní sebevraždu, sebepoškození, že nechce žít, nebo ohrožení sebe či druhých, začni odpověď přesně značkou ${CRISIS_TAG}. Pak projev pochopení, vyzvi ho, ať hned zavolá Linku první psychické pomoci 116 123 (nonstop) nebo v bezprostředním ohrožení 112, a řekni mu, že psycholog dostal upozornění. V takové odpovědi nenabízej cvičení. Značku ${CRISIS_TAG} jindy nepoužívej.

Plán od psychologa:
${client.plan}

<knihovna_technik>
${techniques
  .map((t) => `id: ${t.id}\nnázev: ${t.title}\nkdy: ${t.whenToUse}\npostup: ${t.steps}\nzdroj: ${t.source.name}`)
  .join("\n\n")}
</knihovna_technik>

Poslední check-iny:
${recent || "zatím žádné"}
${last ? `Dnešní stav: nálada ${last.mood}/5, úzkost ${last.anxiety}/10.` : ""}`;
}

export function summaryPrompt(
  client: Client,
  data: { checkins: Checkin[]; tasks: Task[]; messages: Message[]; events: Event[]; alerts: Alert[]; thoughts: ThoughtRecord[] },
) {
  const chat = data.messages
    .map((m) => `${m.role === "user" ? "Klient" : "AI"} (${fmtDate(m.created_at)}): ${m.content}`)
    .join("\n");
  return `Připrav pro psychologa stručné shrnutí před sezením s klientem ${client.name} (${client.focus}). Vycházej jen z dat níže. Česky, nejvýš 140 slov, přesně v tomto formátu:

**Nálada a úzkost:** jedna věta o trendu.
**Úkoly:** jedna věta.
**Témata z rozhovorů a deníku myšlenek:** jedna věta.
**Rizika:** jedna věta, nebo „bez známek rizika“.
**Na co se zeptat:**
- otázka
- otázka

Nepiš diagnózy ani doporučení léčby. Je to podklad, rozhoduje psycholog.

<plan>
${client.plan}
</plan>

<checkiny>
${data.checkins.map((c) => `${fmtDate(c.created_at)}: nálada ${c.mood}/5, úzkost ${c.anxiety}/10${c.note ? `, „${c.note}“` : ""}`).join("\n")}
</checkiny>

<ukoly>
${data.tasks.map((t) => `${t.title}: ${t.week_done}/${t.week_goal} tento týden${t.done_today ? ", dnes splněno" : ""}`).join("\n")}
</ukoly>

<denik_myslenek>
${data.thoughts.map((t) => `${fmtDate(t.created_at)}: situace „${t.situation}“, myšlenka „${t.thought}“, ${t.emotion} ${t.intensity_before} %${t.balanced ? `, vyváženě „${t.balanced}“ → ${t.intensity_after} %` : ""}`).join("\n") || "žádné záznamy"}
</denik_myslenek>

<udalosti>
${data.events.map((e) => `${fmtDate(e.created_at)}: ${e.text}`).join("\n")}
</udalosti>

<upozorneni>
${data.alerts.map((a) => `${fmtDate(a.created_at)}: ${a.text}`).join("\n") || "žádná"}
</upozorneni>

<chat>
${chat || "žádné zprávy"}
</chat>`;
}

/** Spustí streamované volání a vrátí ReadableStream s textem odpovědi. */
export function streamText(params: {
  system?: string;
  messages: Anthropic.Beta.Messages.BetaMessageParam[];
  effort: "low" | "medium" | "high";
  maxTokens: number;
  /** Text, který se pošle, když model nic nevrátí (chyba API nebo odmítnutí). */
  fallbackText: string;
  /** Spustí se po dokončení odpovědi, ještě než se stream zavře (na Vercelu tak funkce neskončí dřív). */
  onDone?: (result: { text: string; refused: boolean }) => Promise<void>;
  /** Text pro ukázkový režim bez API klíče. */
  demoText: string;
}) {
  if (DEMO_MODE) return demoStream(params.demoText, params.onDone);

  const stream = anthropic().beta.messages.stream({
    model: MODEL,
    max_tokens: params.maxTokens,
    system: params.system,
    messages: params.messages,
    thinking: { type: "adaptive" },
    output_config: { effort: params.effort },
    ...FALLBACK,
  });

  const encoder = new TextEncoder();
  let full = "";
  let result = { text: "", refused: false };

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        const refused = final.stop_reason === "refusal";
        if (!full.trim()) {
          full = params.fallbackText;
          controller.enqueue(encoder.encode(full));
        }
        result = { text: full, refused };
      } catch (err) {
        console.error("Claude API error:", err);
        if (!full.trim()) {
          full = params.fallbackText;
          controller.enqueue(encoder.encode(full));
        }
        result = { text: full, refused: false };
      } finally {
        try {
          await params.onDone?.(result);
        } catch (e) {
          console.error("onDone selhalo:", e);
        }
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return { body };
}

/** Ukázkový režim: pošle připravený text po slovech, aby odpověď vypadala jako živá. */
function demoStream(text: string, onDone?: (r: { text: string; refused: boolean }) => Promise<void>) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      await new Promise((r) => setTimeout(r, 600));
      for (const word of text.split(/(?<=\s)/)) {
        controller.enqueue(encoder.encode(word));
        await new Promise((r) => setTimeout(r, 25));
      }
      try {
        await onDone?.({ text, refused: false });
      } catch (e) {
        console.error("onDone selhalo:", e);
      }
      controller.close();
    },
  });
  return { body };
}
