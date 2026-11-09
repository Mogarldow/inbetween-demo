# Inbetween: demo

AI parťák, který podrží klienta mezi terapeutickými sezeními přesně podle plánu jeho psychologa. Psycholog vidí, co se děje, a dostane upozornění, když je klient v ohrožení. **AI navrhuje, psycholog rozhoduje.**

*Inbetween* znamená „mezi“: produkt žije v čase mezi dvěma sezeními u psychologa. Pracovní český název byl Most.

Demo pro 24H Challenge × Mozkovna. Všechna data jsou fiktivní.

## Co demo umí

**Aplikace klienta** (`/klient`)
- Denní check-in: nálada 1–5, úzkost 0–10, poznámka.
- Úkoly z terapie s průběžným plněním za týden.
- AI parťák (Claude), který se řídí plánem psychologa a posledními check-iny. Nediagnostikuje a neradí s léky.
- Krizový protokol: při zmínce o ohrožení zobrazí Linku první psychické pomoci 116 123 a 112 a upozorní psychologa.
- Dechové cvičení 4-4-6 a tlačítko „Potřebuji pomoc hned“.

**Přehled psychologa** (`/psycholog`)
- Seznam klientů se stavem (stabilní, bez check-inu, riziko, čekárna).
- Graf nálady a úzkosti, časová osa „mezi sezeními“, upozornění na riziko.
- AI shrnutí před sezením (návrh, ne diagnóza).
- Úprava plánu, kterým se parťák řídí.

Přehled se obnovuje každé 3 vteřiny. Na prezentaci otevřete obě stránky vedle sebe.

## Ukázkový režim zdarma

Bez `ANTHROPIC_API_KEY` běží demo v ukázkovém režimu: parťák odpovídá předpřipravenými texty (včetně krizového protokolu) a shrnutí se sestaví z dat bez AI. Vercel (Hobby) i Neon (Free) jsou zdarma, takže demo nic nestojí. Po doplnění klíče do proměnných prostředí a novém nasazení přejde chat i shrnutí na živého Clauda.

## Technologie

- **Next.js 16** (frontend i API v jednom projektu)
- **PostgreSQL** (Neon, Supabase nebo lokální), knihovna `pg`
- **Claude API** přes `@anthropic-ai/sdk`, model `claude-opus-5-5`, streamované odpovědi
- Nasazení na **Vercel**

## Spuštění lokálně (databáze + živý Claude zdarma)

Lokálně aplikace nepotřebuje nic dalšího instalovat ani platit:

- **Databáze:** bez `DATABASE_URL` se použije vestavěný Postgres (PGlite) ve složce `.data`. Při prvním startu se sám založí a naplní ukázkovými daty. Všechno, co v aplikaci uděláš, se do něj ukládá a vydrží i restart.
- **Claude:** když je na počítači nainstalovaný a přihlášený **Claude Code** (`claude`), aplikace volá Clauda přes něj, tedy přes tvoje předplatné Claude, bez API klíče. Bez Claude Code běží ukázkové odpovědi, s `ANTHROPIC_API_KEY` se použije Claude API.

Postup:

1. Nainstaluj Node.js 20 nebo novější a Claude Code (a jednou spusť `claude`, aby ses přihlásil).
2. Windows: dvojklik na `spustit-inbetween.bat`. Jinde: `npm install` a `npm run local`.
3. Otevře se http://localhost:3000/klient. Psycholog je na `/psycholog`, režim bez psychologa na `/klient?id=nikola`.

Data vrátíš do výchozího stavu přes `npm run db:reset`. Model zvolíš proměnnou `CLAUDE_CLI_MODEL` (výchozí `opus`, rychlejší `sonnet`).

Vývoj s vlastním Postgresem: nastav `DATABASE_URL`, spusť `npm run db:setup` a `npm run dev`.

## Nasazení (Vercel + Neon)

1. **Databáze:** na [neon.tech](https://neon.tech) založ projekt (přihlášení přes GitHub) a zkopíruj connection string.
2. **Data:** u sebe spusť `DATABASE_URL="<connection string>" npm run db:setup`, nebo obsah `db/schema.sql` a `db/seed.sql` vlož do SQL editoru v Neonu.
3. **Claude (volitelné):** na [console.anthropic.com](https://console.anthropic.com) vytvoř API klíč a nabij kredit. Bez klíče běží ukázkový režim zdarma.
4. **Vercel:** na [vercel.com](https://vercel.com) zvol *Add New → Project*, vyber tento repozitář a v *Environment Variables* nastav `DATABASE_URL` a `ANTHROPIC_API_KEY`. Klikni na *Deploy*.

Každý push do `main` se pak nasadí automaticky.

**Reset dema:** `npm run db:setup` smaže data a nahraje znovu ukázková.

## Struktura

```
app/klient/        aplikace klienta
app/psycholog/     přehled psychologa
app/api/           chat, check-iny, úkoly, SOS, plán, shrnutí, stav
lib/claude.ts      prompty a volání Claude
lib/db.ts          přístup k databázi
lib/risk.ts        záložní detekce rizikových formulací
db/                schéma a ukázková data
```

## Bezpečnost a omezení dema

- Demo nemá přihlašování. Klient je napevno Petra a psycholog vidí všechny klienty. Pro reálný provoz je potřeba autentizace, oddělení dat po psychologech, šifrování a hosting v EU (GDPR).
- AI nedělá klinická rozhodnutí. Detekce rizika je kombinace pokynu pro model a jednoduchých pravidel a nenahrazuje odborné posouzení.
- Při odmítnutí požadavku bezpečnostním filtrem API automaticky použije záložní model (`fallbacks: "default"`). Když Claude neodpoví vůbec, klient vždy dostane krizové kontakty.
