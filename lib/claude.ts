import Anthropic from "@anthropic-ai/sdk";
import type { Checkin, Client, Event, Message, Task, Alert } from "./db";
import { CRISIS_TAG } from "./risk";

export const anthropic = new Anthropic(); // čte ANTHROPIC_API_KEY z prostředí
export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

// Server-side fallback: když bezpečnostní klasifikátor požadavek odmítne,
// API ho samo zopakuje na doporučeném záložním modelu.
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export function companionSystemPrompt(client: Client, checkins: Checkin[]) {
  const last = checkins.at(-1);
  const recent = checkins
    .slice(-3)
    .map((c) => `${fmtDate(c.created_at)}: nálada ${c.mood}/5, úzkost ${c.anxiety}/10${c.note ? `, „${c.note}“` : ""}`)
    .join("\n");
  const first = client.name.split(" ")[0];
  return `Jsi Inbetween, AI parťák klienta mezi terapeutickými sezeními. Klient se jmenuje ${first}, jeho psycholog je ${client.therapist}. Příští sezení: ${client.next_session}.

Jak mluvíš: česky, tykáš, vřele a věcně. Nejvýš 3–4 krátké věty, bez nadpisů a bez markdownu. Na konci nejvýš jedna otázka.

Tvoje role: pomáháš klientovi držet se plánu, který nastavil psycholog. Nejsi terapeut ani lékař. Nediagnostikuješ, neradíš s léky ani dávkováním a plán neměníš. Když se klient ptá na léky, diagnózu nebo změnu terapie, laskavě ho odkaž na psychologa nebo lékaře a navrhni, ať si otázku zapíše na sezení. Nabízej hlavně techniky z plánu.

Krizový protokol: pokud klient zmíní sebevraždu, sebepoškození, že nechce žít, nebo ohrožení sebe či druhých, začni odpověď přesně značkou ${CRISIS_TAG}. Pak projev pochopení, vyzvi ho, ať hned zavolá Linku první psychické pomoci 116 123 (nonstop) nebo v bezprostředním ohrožení 112, a řekni mu, že psycholog dostal upozornění. V takové odpovědi nenabízej cvičení. Značku ${CRISIS_TAG} jindy nepoužívej.

Plán od psychologa:
${client.plan}

Poslední check-iny:
${recent || "zatím žádné"}
${last ? `Dnešní stav: nálada ${last.mood}/5, úzkost ${last.anxiety}/10.` : ""}`;
}

export function summaryPrompt(
  client: Client,
  data: { checkins: Checkin[]; tasks: Task[]; messages: Message[]; events: Event[]; alerts: Alert[] },
) {
  const chat = data.messages
    .map((m) => `${m.role === "user" ? "Klient" : "AI"} (${fmtDate(m.created_at)}): ${m.content}`)
    .join("\n");
  return `Připrav pro psychologa stručné shrnutí před sezením s klientem ${client.name} (${client.focus}). Vycházej jen z dat níže. Česky, nejvýš 140 slov, přesně v tomto formátu:

**Nálada a úzkost:** jedna věta o trendu.
**Úkoly:** jedna věta.
**Témata z rozhovorů:** jedna věta.
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
}) {
  const stream = anthropic.beta.messages.stream({
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
