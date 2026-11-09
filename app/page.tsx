import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <div>
        <span className="label">24H Challenge × Mozkovna · demo</span>
        <h1>Inbetween</h1>
        <p className="tag">Your therapy between sessions. Terapie nekončí odchodem z ordinace.</p>
      </div>
      <p>
        AI parťák podrží klienta mezi sezeními přesně podle plánu jeho psychologa. Psycholog vidí, co se děje, a dostane
        upozornění, když je klient v ohrožení. AI navrhuje, psycholog rozhoduje.
      </p>
      <div className="roles">
        <Link className="role" href="/klient">
          <span className="label">Aplikace klienta</span>
          <h2>Jsem klient</h2>
          <span className="note">Check-in, úkoly z terapie, AI parťák a krizové linky.</span>
        </Link>
        <Link className="role" href="/psycholog">
          <span className="label">Přehled psychologa</span>
          <h2>Jsem psycholog</h2>
          <span className="note">Klienti, trend nálady, upozornění na riziko a shrnutí před sezením.</span>
        </Link>
      </div>
      <p className="note">
        Tip na prezentaci: otevři obě stránky vedle sebe. Co klient udělá v aplikaci, psycholog uvidí během pár vteřin.
        Data jsou fiktivní.
      </p>
    </main>
  );
}
