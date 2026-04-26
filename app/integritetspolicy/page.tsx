"use client";

export default function IntegritetspolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Integritetspolicy</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-10">Senast uppdaterad: april 2026</p>

        <div className="space-y-8 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">1. Personuppgiftsansvarig</h2>
            <p>
              SportIQ är personuppgiftsansvarig för behandlingen av dina personuppgifter inom tjänsten.
              Vid frågor om hur vi hanterar dina uppgifter, kontakta oss på{" "}
              <a href="mailto:support@sport-iq.se" className="text-orange-400 hover:underline">
                support@sport-iq.se
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">2. Vilka uppgifter samlar vi in?</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Namn och e-postadress (vid registrering)</li>
              <li>Telefonnummer och biografi (valfritt, anges av dig)</li>
              <li>Roll i föreningen (tränare, förälder, spelare m.m.)</li>
              <li>Barnets namn (för föräldrar som registrerar barn)</li>
              <li>Närvaro- och RSVP-data kopplade till träningar och matcher</li>
              <li>Meddelanden skickade i appen</li>
              <li>Profilbild (om du laddar upp en)</li>
              <li>Skjutsdata (om du anmäler dig till samåkning)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">3. Ändamål och rättslig grund</h2>
            <p className="mb-2">
              Vi behandlar dina uppgifter för att tillhandahålla tjänstens funktioner — schemaläggning,
              kommunikation inom laget, närvaro och matchhantering. Den rättsliga grunden är{" "}
              <strong>avtal</strong> (GDPR art. 6.1 b) — behandlingen är nödvändig för att fullgöra
              tjänsten du använder.
            </p>
            <p>
              För barn under 16 år gäller att samtycke från vårdnadshavare krävs (GDPR art. 8).
              Föräldrar registrerar barnets uppgifter och ansvarar för att samtycke föreligger.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">4. Hur länge sparas uppgifterna?</h2>
            <p>
              Dina uppgifter sparas så länge ditt konto är aktivt. Om du tar bort ditt konto raderas
              alla personuppgifter (profil, meddelanden, närvaro, RSVP m.m.) omedelbart och permanent.
              Säkerhetskopior kan behålla uppgifter i upp till 30 dagar efter radering.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">5. Delning med tredje part</h2>
            <p className="mb-2">Vi delar uppgifter med följande underleverantörer (personuppgiftsbiträden):</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Supabase Inc.</strong> — databas och autentisering. Servrar i EU (eu-west-1).
              </li>
              <li>
                <strong>Resend Inc.</strong> — e-postutskick (t.ex. välkomstmail, lösenordsåterställning).
              </li>
              <li>
                <strong>Anthropic, PBC</strong> — AI-funktioner (t.ex. träningsplanering). Indata
                skickas till Anthropics API och behandlas enligt deras datapolicy.
              </li>
            </ul>
            <p className="mt-2">
              Vi säljer aldrig dina uppgifter till tredje part och delar dem inte utanför ovanstående
              biträden utan ditt uttryckliga samtycke.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">6. Dina rättigheter (GDPR)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Rätt till tillgång (art. 15)</strong> — du kan ladda ner alla dina uppgifter
                via Profil → "Ladda ner min data".
              </li>
              <li>
                <strong>Rätt till radering (art. 17)</strong> — du kan permanent radera ditt konto
                via Profil → "Ta bort mitt konto".
              </li>
              <li>
                <strong>Rätt till rättelse (art. 16)</strong> — du kan ändra namn, telefon, bio och
                profilbild direkt i appen.
              </li>
              <li>
                <strong>Rätt till dataportabilitet (art. 20)</strong> — data exporteras i
                maskinläsbart JSON-format.
              </li>
              <li>
                <strong>Rätt att invända (art. 21)</strong> — kontakta oss om du har invändningar
                mot behandlingen.
              </li>
            </ul>
            <p className="mt-2">
              Du har också rätt att lämna klagomål till Integritetsskyddsmyndigheten (IMY) på{" "}
              <a
                href="https://www.imy.se"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline"
              >
                imy.se
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">7. Cookies och spårning</h2>
            <p>
              Tjänsten använder en session-cookie för autentisering (nödvändig för inloggning).
              Vi använder inga spårnings- eller marknadsföringscookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">8. Säkerhet</h2>
            <p>
              All kommunikation sker över HTTPS. Lösenord lagras aldrig i klartext — Supabase
              hanterar autentisering med bcrypt-hashning. Åtkomst till data i databasen styrs av
              Row-Level Security (RLS) så att användare enbart kan se data de är behöriga till.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">9. Kontakt</h2>
            <p>
              Har du frågor om hur vi hanterar dina personuppgifter? Kontakta oss på{" "}
              <a href="mailto:support@sport-iq.se" className="text-orange-400 hover:underline">
                support@sport-iq.se
              </a>.
            </p>
          </section>

        </div>

        <div className="mt-10 border-t border-slate-200 dark:border-slate-700 pt-6">
          <a href="/profil" className="text-sm text-orange-400 hover:underline">← Tillbaka till profilen</a>
        </div>
      </div>
    </div>
  );
}
