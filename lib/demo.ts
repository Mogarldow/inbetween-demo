// Ukázkový režim: když není nastavený ANTHROPIC_API_KEY, aplikace odpovídá
// předpřipravenými texty. Demo tak běží zdarma; po doplnění klíče přejde na živou AI.
import type { Alert, Checkin, Client, Event, Message, Task } from "./db";
import { CRISIS_TAG, isRisky } from "./risk";

export const DEMO_MODE = !process.env.ANTHROPIC_API_KEY;

export function demoChatReply(text: string, client: Client) {
  const therapist = client.therapist.split(" ").at(-2) ?? "tvůj psycholog";
  if (isRisky(text)) {
    return `${CRISIS_TAG} Moc děkuju, že jsi mi to napsal/a. To, co prožíváš, je vážné a nemusíš na to být sám/sama. Prosím, zavolej hned Linku první psychické pomoci 116 123, je tam někdo nonstop. Pokud jsi v bezprostředním ohrožení, volej 112. ${therapist} dostal/a upozornění.`;
  }
  if (/porad|prezentac|šéf|vedení|práce|práci/i.test(text)) {
    return "Před poradou je úzkost úplně pochopitelná. Zkus teď dvě minuty dýchání 4-4-6 a pak si do deníku zapiš myšlenku, která tě nejvíc tíží, třeba „všechno zkazím“. Jaký důkaz pro ni a proti ní máš?";
  }
  if (/spát|spím|nespav|usnout|spánek/i.test(text)) {
    return `Špatný spánek se před náročným dnem objevuje často. Zkus před spaním dýchání 4-4-6 a myšlenky, které ti běží hlavou, si zapiš do deníku, ať je tam nemusíš držet. ${therapist} to s tebou na sezení ráda probere. Co tě dnes večer nejvíc zaměstnává?`;
  }
  if (/lék|prášk|dávk|antidepres/i.test(text)) {
    return `S léky ti radit nemůžu, to patří tvé lékařce nebo psychologovi. Napiš si otázku, ať ji na sezení nezapomeneš. Chceš mezitím zkusit něco, co ti teď pomůže se zklidnit?`;
  }
  if (/díky|děkuju|dík|lepší|pomohlo/i.test(text)) {
    return "To jsem rád/a. Zapiš si do deníku, co ti pomohlo, ať to máš po ruce i příště. Je ještě něco, co tě dnes trápí?";
  }
  return "Díky, že to sdílíš. Zkus pojmenovat, co přesně teď cítíš a jak silné to je na škále 0–10. Podle plánu ti může pomoct dýchání 4-4-6 nebo krátká procházka. Co z toho zkusíš?";
}

export function demoSummary(
  client: Client,
  d: { checkins: Checkin[]; tasks: Task[]; messages: Message[]; events: Event[]; alerts: Alert[] },
) {
  const c = d.checkins;
  const avg = (k: "mood" | "anxiety") => (c.length ? (c.reduce((s, x) => s + x[k], 0) / c.length).toFixed(1) : "–");
  const last = c.at(-1);
  const worst = [...c].sort((a, b) => b.anxiety - a.anxiety)[0];
  const tasks = d.tasks.map((t) => `${t.title.toLowerCase()} ${t.week_done}/${t.week_goal}`).join(", ");
  const userMsgs = d.messages.filter((m) => m.role === "user").map((m) => `„${m.content.slice(0, 60)}“`);
  const notes = c.filter((x) => x.note).map((x) => `„${x.note}“`).slice(-2);
  return `**Nálada a úzkost:** za posledních ${c.length} check-inů průměrná nálada ${avg("mood")}/5 a úzkost ${avg("anxiety")}/10${last ? `, naposledy ${last.mood}/5 a ${last.anxiety}/10` : ""}.${worst?.note ? ` Nejvyšší úzkost u poznámky „${worst.note}“.` : ""}
**Úkoly:** ${tasks || "bez zadaných úkolů"}.
**Témata z rozhovorů:** ${userMsgs.length ? userMsgs.slice(-3).join(", ") : notes.length ? `z poznámek ${notes.join(", ")}` : "klient tento týden s parťákem nepsal"}.
**Rizika:** ${d.alerts.length ? d.alerts.map((a) => a.text).join(" ") : "bez známek rizika"}
**Na co se zeptat:**
- Jak proběhly situace, kterých se klient obával, oproti tomu, co čekal?
- Co z technik v plánu pomáhá nejvíc a co nefunguje?
${d.alerts.length ? "- Jak je na tom teď s bezpečím a koho má kolem sebe?" : "- Jak spí posledních pár nocí?"}

Ukázkový režim: shrnutí je sestavené z dat bez AI.`;
}
