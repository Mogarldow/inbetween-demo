// Materiály z knihovny psychologa (sdílené typy pro server i prohlížeč).
export type Material = { id: number; kind: "technika" | "ukol" | "kbt" | "poznamka"; title: string; body: string; week_goal: number; created_at: string };
export const KIND_LABEL: Record<Material["kind"], string> = { technika: "Technika", ukol: "Úkol", kbt: "KBT cvičení", poznamka: "Poznámka" };
