// Knihovna ověřených technik, ze které parťák čerpá.
// Texty jsou stručná česká převyprávění běžně používaných postupů (KBT, práce se stresem).
// V reálném provozu je spravuje a schvaluje odborný tým; tady slouží jako ukázka pro demo.

export type Technique = {
  id: string;
  title: string;
  category: "Zklidnění" | "Myšlenky (KBT)" | "Aktivita" | "Spánek" | "Úzkost" | "Krize";
  whenToUse: string;
  steps: string;
  keywords: string[]; // kmeny slov pro jednoduché vyhledání
  source: { name: string; url: string };
};

export const CRISIS_TECHNIQUE_ID = "krizovy-postup";

export const TECHNIQUES: Technique[] = [
  {
    id: "dech-446",
    title: "Dýchání 4-4-6",
    category: "Zklidnění",
    whenToUse: "Akutní úzkost, napětí, bušení srdce, před stresovou situací.",
    steps: "Nádech nosem na 4 doby, zadržet na 4, pomalý výdech ústy na 6. Opakovat 3–5 minut. Delší výdech zklidňuje tělo.",
    keywords: ["úzkost", "nervy", "panik", "srdce", "dech", "dýchá", "napět", "stres", "klid", "porad", "strach"],
    source: { name: "NHS: Breathing exercises for stress", url: "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/" },
  },
  {
    id: "uzemneni-54321",
    title: "Uzemnění 5-4-3-2-1",
    category: "Zklidnění",
    whenToUse: "Když člověka pohltí myšlenky nebo panika a potřebuje se vrátit do přítomnosti.",
    steps: "Pojmenuj 5 věcí, které vidíš, 4, kterých se dotkneš, 3, které slyšíš, 2, které cítíš čichem, a 1, kterou cítíš chutí.",
    keywords: ["panik", "pohlt", "ztrác", "mimo", "nereál", "zahlc", "hlav", "točí", "uklidn"],
    source: { name: "WHO: Doing What Matters in Times of Stress", url: "https://www.who.int/publications/i/item/9789240003927" },
  },
  {
    id: "zaznam-myslenek",
    title: "Záznam myšlenek",
    category: "Myšlenky (KBT)",
    whenToUse: "Po situaci, která vyvolala silnou emoci. Základní nástroj KBT.",
    steps: "Zapiš situaci, automatickou myšlenku, emoci a její sílu 0–100. Pak hledej vyváženější pohled a znovu ohodnoť sílu emoce.",
    keywords: ["myšlen", "deník", "zapsat", "zapiš", "hlav", "pořád", "přemýšl", "zkazím", "selž"],
    source: { name: "NHS Every Mind Matters: Reframing unhelpful thoughts", url: "https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/reframing-unhelpful-thoughts/" },
  },
  {
    id: "dukazy-pro-proti",
    title: "Důkazy pro a proti",
    category: "Myšlenky (KBT)",
    whenToUse: "Když člověk věří negativní myšlence jako faktu („všechno zkazím“, „nikdo mě nemá rád“).",
    steps: "Vezmi jednu myšlenku. Sepiš fakta, která ji podporují, a fakta, která ji vyvracejí. Co by řekl kamarád, kdyby tohle slyšel od tebe?",
    keywords: ["zkazím", "selž", "nikdo", "vždycky", "nikdy", "neschopn", "trapn", "hloup", "myslí si"],
    source: { name: "NHS Every Mind Matters: Reframing unhelpful thoughts", url: "https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/reframing-unhelpful-thoughts/" },
  },
  {
    id: "dekatastrofizace",
    title: "Nejhorší, nejlepší, nejpravděpodobnější",
    category: "Myšlenky (KBT)",
    whenToUse: "Katastrofické představy o budoucnosti, obavy z blížící se události.",
    steps: "Popiš nejhorší možný scénář, pak nejlepší a nakonec ten nejpravděpodobnější. Co bys udělal/a, kdyby nastal ten nejhorší?",
    keywords: ["zítra", "porad", "prezentac", "zkouš", "bojím", "obáv", "dopad", "katastrof", "co když"],
    source: { name: "NHS: Cognitive behavioural therapy (CBT)", url: "https://www.nhs.uk/mental-health/talking-therapies-medicine-treatments/talking-therapies-and-counselling/cognitive-behavioural-therapy-cbt/overview/" },
  },
  {
    id: "cas-na-starosti",
    title: "Čas na starosti",
    category: "Úzkost",
    whenToUse: "Neustálé přemítání a obavy, které se vracejí během dne.",
    steps: "Vyhraď si denně 15 minut na starosti. Když obava přijde jindy, zapiš ji a odlož na ten čas. Pak projdi, co se dá řešit a co ne.",
    keywords: ["starost", "obav", "pořád", "přemýšl", "nemůžu přestat", "točí", "celý den"],
    source: { name: "NHS Every Mind Matters", url: "https://www.nhs.uk/every-mind-matters/" },
  },
  {
    id: "postupna-expozice",
    title: "Postupné vystavování",
    category: "Úzkost",
    whenToUse: "Vyhýbání se obávaným situacím, sociální úzkost.",
    steps: "Sestav žebříček situací od nejméně po nejvíc náročnou. Začni tou nejsnazší a zůstaň v ní, dokud úzkost neklesne. Až pak jdi o stupeň výš.",
    keywords: ["vyhýb", "nejdu", "nepůjdu", "omluv", "lidi", "trapn", "společn", "mluvit", "sociál"],
    source: { name: "NHS: Social anxiety", url: "https://www.nhs.uk/mental-health/conditions/social-anxiety/" },
  },
  {
    id: "mala-aktivita",
    title: "Malá příjemná aktivita",
    category: "Aktivita",
    whenToUse: "Únava, nechuť, vyhoření, pocit prázdnoty (behaviorální aktivace).",
    steps: "Vyber jednu malou činnost, která dřív přinášela radost nebo smysl, a naplánuj si ji na konkrétní čas. Po ní ohodnoť náladu 0–10.",
    keywords: ["nemám chuť", "nic mě", "unaven", "vyhoř", "prázdn", "smutn", "nebaví", "ležím"],
    source: { name: "NHS: Cognitive behavioural therapy (CBT)", url: "https://www.nhs.uk/mental-health/talking-therapies-medicine-treatments/talking-therapies-and-counselling/cognitive-behavioural-therapy-cbt/overview/" },
  },
  {
    id: "prochazka",
    title: "Procházka 20 minut",
    category: "Aktivita",
    whenToUse: "Napětí, špatná nálada, přemítání. Pohyb pomáhá snížit stres.",
    steps: "Jdi ven na 20 minut svižnou chůzí, ideálně bez telefonu. Všímej si okolí, ne myšlenek.",
    keywords: ["pohyb", "procház", "ven", "sport", "napět", "nálad", "zavřen"],
    source: { name: "NHS: Exercise for depression", url: "https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/exercise-for-depression/" },
  },
  {
    id: "spankova-hygiena",
    title: "Večerní rutina pro spánek",
    category: "Spánek",
    whenToUse: "Potíže s usínáním, noční přemítání.",
    steps: "Hodinu před spaním bez obrazovek, stejný čas usínání i vstávání, myšlenky zapsat na papír. Když nejde usnout do 20 minut, vstát a dělat něco klidného.",
    keywords: ["spát", "spím", "spánek", "usnout", "nespav", "noc", "budím", "unaven"],
    source: { name: "NHS Every Mind Matters: How to fall asleep faster and sleep better", url: "https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/how-to-fall-asleep-faster-and-sleep-better/" },
  },
  {
    id: "laskava-veta",
    title: "Laskavá věta k sobě",
    category: "Myšlenky (KBT)",
    whenToUse: "Sebekritika, pocit selhání, stud.",
    steps: "Představ si, co bys řekl/a dobrému kamarádovi ve stejné situaci. Napiš si tu větu a řekni ji sám/sama sobě.",
    keywords: ["stydím", "selhal", "neschopn", "vina", "nenávid", "hloup", "zklamal"],
    source: { name: "WHO: Doing What Matters in Times of Stress", url: "https://www.who.int/publications/i/item/9789240003927" },
  },
  {
    id: CRISIS_TECHNIQUE_ID,
    title: "Krizový postup",
    category: "Krize",
    whenToUse: "Myšlenky na sebevraždu, sebepoškození, ohrožení sebe nebo druhých. Má přednost před vším ostatním.",
    steps: "Nezůstávat sám/sama. Hned volat Linku první psychické pomoci 116 123 (nonstop, zdarma), v bezprostředním ohrožení 112. Psycholog dostane upozornění.",
    keywords: [],
    source: { name: "Linka první psychické pomoci 116 123", url: "https://www.linkapsychickepomoci.cz/" },
  },
];

const byId = new Map(TECHNIQUES.map((t) => [t.id, t]));
export const getTechnique = (id: string) => byId.get(id);

/** Vybere nejvýš `limit` technik z povolených, které nejlépe odpovídají textu. */
export function retrieveTechniques(text: string, allowedIds: string[], limit = 3): Technique[] {
  const lower = text.toLowerCase();
  const allowed = allowedIds.map((id) => byId.get(id)).filter((t): t is Technique => !!t && t.id !== CRISIS_TECHNIQUE_ID);
  const scored = allowed
    .map((t) => ({ t, score: t.keywords.filter((k) => lower.includes(k)).length }))
    .sort((a, b) => b.score - a.score);
  const hits = scored.filter((s) => s.score > 0).map((s) => s.t);
  // když nic nesedí, nabídni první povolené techniky z plánu
  return (hits.length ? hits : allowed).slice(0, limit);
}

export const SOURCE_TAG = "[ZDROJE:";

/** Odstraní značku se zdroji z konce odpovědi a vrátí čistý text + ID technik. */
export function splitSources(text: string): { text: string; ids: string[] } {
  const i = text.lastIndexOf(SOURCE_TAG);
  if (i === -1) {
    // během streamování může být na konci jen začátek značky („[ZDR“)
    for (let n = SOURCE_TAG.length - 1; n > 0; n--) {
      if (text.endsWith(SOURCE_TAG.slice(0, n))) return { text: text.slice(0, -n).trim(), ids: [] };
    }
    return { text, ids: [] };
  }
  const ids = text
    .slice(i + SOURCE_TAG.length)
    .replace("]", "")
    .split(",")
    .map((s) => s.trim())
    .filter((id) => byId.has(id));
  return { text: text.slice(0, i).trim(), ids };
}
