import { NextRequest, NextResponse } from "next/server";
import { addAlert, addEvent, getClient, q, type Checkin, type Message, getClientMaterials } from "@/lib/db";
import { companionSystemPrompt, streamText } from "@/lib/claude";
import { demoChatReply } from "@/lib/demo";
import { getTechnique, retrieveTechniques, CRISIS_TECHNIQUE_ID } from "@/lib/techniques";
import { CRISIS_TAG, isRisky } from "@/lib/risk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SAFE_FALLBACK =
  "Teď ti bohužel nedokážu odpovědět. Jestli je ti hodně zle, zavolej prosím Linku první psychické pomoci 116 123 (nonstop), v ohrožení 112. Svému psychologovi můžeš napsat i přímo.";

export async function POST(req: NextRequest) {
  const { clientId, text } = await req.json();
  const message = typeof text === "string" ? text.trim().slice(0, 2000) : "";
  if (!clientId || !message) return NextResponse.json({ error: "Prázdná zpráva." }, { status: 400 });

  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });

  await q("INSERT INTO messages (client_id, role, content) VALUES ($1, 'user', $2)", [clientId, message]);
  await addEvent(
    clientId,
    client.share_chat
      ? `Chat s parťákem: „${message.length > 80 ? message.slice(0, 80) + "…" : message}“`
      : "Chat s parťákem (znění klient nesdílí, uvidíte ho jen ve shrnutí).",
  );

  const localRisk = isRisky(message);
  if (localRisk) {
    await addAlert(clientId, "chat", "V chatu zazněla zmínka o ohrožení sebe. Parťák aktivoval krizový protokol.");
  }

  const [checkins, history, materials] = await Promise.all([
    q<Checkin>("SELECT * FROM (SELECT * FROM checkins WHERE client_id = $1 ORDER BY created_at DESC LIMIT 3) t ORDER BY created_at", [clientId]),
    q<Message>("SELECT * FROM (SELECT * FROM messages WHERE client_id = $1 ORDER BY created_at DESC LIMIT 20) t ORDER BY created_at", [clientId]),
    getClientMaterials(clientId),
  ]);

  // Vybereme techniky z knihovny, které psycholog povolil a které k situaci sedí.
  const recentText = [...history.slice(-4).map((m) => m.content), message].join(" ");
  const techniques = retrieveTechniques(recentText, client.allowed_techniques ?? []);
  if (localRisk) techniques.unshift(getTechnique(CRISIS_TECHNIQUE_ID)!);

  // API vyžaduje, aby konverzace začínala zprávou uživatele.
  const turns = history.map((m) => ({ role: m.role, content: m.content }));
  while (turns.length && turns[0].role !== "user") turns.shift();

  const { body } = streamText({
    system: companionSystemPrompt(client, checkins, techniques, materials),
    messages: turns,
    effort: "low",
    maxTokens: 2000,
    fallbackText: localRisk
      ? `${CRISIS_TAG} Děkuju, že jsi mi to napsal/a. Prosím, zavolej hned Linku první psychické pomoci 116 123, je tam někdo nonstop. Pokud jsi v bezprostředním ohrožení, volej 112. Tvůj psycholog dostal upozornění.`
      : SAFE_FALLBACK,
    demoText: demoChatReply(message, client, techniques),
    // Po dokončení uložíme odpověď a případně upozornění.
    onDone: async ({ text: reply }) => {
      await q("INSERT INTO messages (client_id, role, content) VALUES ($1, 'assistant', $2)", [clientId, reply]);
      if (reply.trimStart().startsWith(CRISIS_TAG) && !localRisk) {
        await addAlert(clientId, "chat", "Parťák vyhodnotil zprávu jako rizikovou a aktivoval krizový protokol.");
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
