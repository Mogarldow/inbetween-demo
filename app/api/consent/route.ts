import { NextRequest, NextResponse } from "next/server";
import { addEvent, getClient, q } from "@/lib/db";

export const dynamic = "force-dynamic";

type Reminder = { title: string; when: string; on: boolean };

// Souhlasy se sdílením a nastavení připomínek. Mění je jen klient.
export async function PUT(req: NextRequest) {
  const b = await req.json();
  const client = await getClient(b.clientId);
  if (!client) return NextResponse.json({ error: "Klient neexistuje." }, { status: 404 });

  const flags = { share_thoughts: "deník myšlenek", share_scores: "výsledky dotazníků", share_chat: "celé znění chatu" } as const;
  for (const [col, label] of Object.entries(flags) as [keyof typeof flags, string][]) {
    if (typeof b[col] === "boolean" && b[col] !== client[col]) {
      await q(`UPDATE clients SET ${col} = $2 WHERE id = $1`, [client.id, b[col]]);
      await addEvent(client.id, `Klient ${b[col] ? "začal sdílet" : "přestal sdílet"}: ${label}.`);
    }
  }
  if (Array.isArray(b.reminders)) {
    const rem: Reminder[] = b.reminders.slice(0, 10).map((r: Reminder) => ({
      title: String(r.title).slice(0, 60), when: String(r.when).slice(0, 60), on: !!r.on,
    }));
    await q("UPDATE clients SET reminders = $2 WHERE id = $1", [client.id, JSON.stringify(rem)]);
  }
  return NextResponse.json({ ok: true });
}
