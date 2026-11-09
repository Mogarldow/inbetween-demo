import { NextRequest, NextResponse } from "next/server";
import { addEvent, getClientState, q } from "@/lib/db";
import { streamText } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST {clientId, draft: true} -> AI navrhne body na sezení; POST {clientId, text} -> uloží a pošle psychologovi
export async function POST(req: NextRequest) {
  const { clientId, text, draft } = await req.json();
  const s = await getClientState(clientId);
  if (!s.client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });

  if (!draft) {
    const v = typeof text === "string" ? text.trim().slice(0, 2000) : "";
    if (!v) return NextResponse.json({ error: "Napiš aspoň jednu věc." }, { status: 400 });
    await q("UPDATE clients SET prep = $2 WHERE id = $1", [clientId, v]);
    await addEvent(clientId, "Klient poslal, co chce probrat na sezení.");
    return NextResponse.json({ ok: true });
  }

  const data = [
    `Check-iny: ${s.checkins.map((c) => `nálada ${c.mood}/5, úzkost ${c.anxiety}/10${c.note ? ` „${c.note}“` : ""}`).join("; ")}`,
    `Úkoly: ${s.tasks.map((t) => `${t.title} ${t.week_done}/${t.week_goal}`).join("; ")}`,
    `Deník myšlenek: ${s.thoughts.map((t) => `„${t.thought}“ (${t.emotion} ${t.intensity_before} %)`).join("; ") || "nic"}`,
    `Chat: ${s.messages.filter((m) => m.role === "user").map((m) => m.content).join(" / ").slice(0, 1500) || "nic"}`,
    `Už si napsal/a: ${typeof text === "string" && text.trim() ? text.trim() : "nic"}`,
  ].join("\n");
  const thought = s.thoughts[0]?.thought;
  const demo = [
    typeof text === "string" && text.trim() ? text.trim() : null,
    "- Jak proběhlo to, čeho jsem se tento týden bál/a, oproti tomu, co jsem čekal/a.",
    thought ? `- Myšlenka „${thought}“: deník pomáhá, ale vrací se.` : "- Co z technik mi pomáhá a co ne.",
    "- Jak spím a co s večery, kdy se mi točí hlava.",
  ].filter(Boolean).join("\n");

  const { body } = streamText({
    messages: [{
      role: "user",
      content: `Pomáháš klientovi ${s.client.name} připravit se na sezení s psychologem. Z dat níže navrhni 3 krátké body, které by mohl chtít probrat. Piš v první osobě za klienta, česky, každý bod na nový řádek začínající „- “, nejvýš 15 slov na bod. Žádné diagnózy. Zachovej, co už si napsal.\n\n${data}`,
    }],
    effort: "low",
    maxTokens: 2000,
    fallbackText: demo,
    demoText: demo,
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
