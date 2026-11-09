// Standardizované dotazníky GAD-7 (úzkost) a PHQ-9 (deprese). Oba jsou volně k použití.
// Spitzer a kol. 2006 (GAD-7), Kroenke a kol. 2001 (PHQ-9). Skóre je orientační screening, ne diagnóza.

export type QKind = "gad7" | "phq9";

export const OPTIONS = ["Vůbec ne", "Několik dní", "Víc než půlku dní", "Skoro každý den"];

export const QUESTIONNAIRES: Record<QKind, { name: string; title: string; max: number; items: string[] }> = {
  gad7: {
    name: "GAD-7",
    title: "Úzkost (GAD-7)",
    max: 21,
    items: [
      "Pocit nervozity, úzkosti nebo napětí",
      "Neschopnost zastavit nebo ovládat obavy",
      "Přílišné obavy z různých věcí",
      "Potíže se uvolnit",
      "Neklid, kvůli kterému je těžké vydržet sedět",
      "Snadné podráždění nebo rozladění",
      "Strach, jako by se mohlo stát něco hrozného",
    ],
  },
  phq9: {
    name: "PHQ-9",
    title: "Nálada (PHQ-9)",
    max: 27,
    items: [
      "Malý zájem o věci nebo malá radost z nich",
      "Pocit sklíčenosti, smutku nebo beznaděje",
      "Potíže usnout, spát bez přerušení, nebo naopak moc spánku",
      "Únava nebo nedostatek energie",
      "Nechutenství nebo přejídání",
      "Špatný pocit ze sebe, že jsi selhal/a nebo zklamal/a sebe či blízké",
      "Potíže soustředit se, třeba na čtení nebo seriál",
      "Zpomalené pohyby či řeč, nebo naopak neklid",
      "Myšlenky, že by bylo lepší nežít, nebo na ublížení sobě",
    ],
  },
};

/** Pásmo závažnosti a barva pro zobrazení. */
export function band(kind: QKind, score: number): { label: string; tone: "ok" | "warn" | "risk" } {
  if (score < 5) return { label: "minimální", tone: "ok" };
  if (score < 10) return { label: "mírná", tone: "ok" };
  if (score < 15) return { label: kind === "phq9" ? "středně těžká" : "střední", tone: "warn" };
  return { label: "těžká", tone: "risk" };
}

export const isQKind = (v: unknown): v is QKind => v === "gad7" || v === "phq9";
