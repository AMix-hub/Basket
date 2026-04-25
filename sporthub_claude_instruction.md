# SportHub – utvecklingsinstruktion för Claude

Du är Claude och körs i PowerShell i projektmappen.  
Din uppgift är att analysera projektet, förstå befintlig kodstruktur och sedan stegvis bygga vidare på tjänsten enligt planen nedan.

Viktigt:
- Gör inte allt på en gång.
- Arbeta steg för steg.
- Läs igenom projektets filer först.
- Identifiera vilket ramverk/projektstruktur som används.
- Skapa en kort TODO-plan innan du börjar ändra kod.
- Efter varje större steg: kör relevanta tester/build/lint om det finns.
- Om något saknas i projektet, skapa det på ett rimligt sätt.
- Om något är oklart, gör en rimlig teknisk tolkning och fortsätt.
- Undvik att skriva om hela projektet i onödan.
- Prioritera fungerande grundfunktioner före avancerade features.
- Håll koden ren, modulär och lätt att bygga vidare på.

---

# Projektidé

Tjänsten är en sporthub för föreningar inom olika idrotter.  
Syftet är att föreningar, lag, tränare, spelare och föräldrar ska kunna ha allt på ett ställe.

Tjänsten ska kunna användas för exempelvis:
- Träningar
- Matcher
- Kallelser
- Närvaro
- Övningar
- Träningsplanering
- Interaktiv taktiktavla
- Kommunikation
- Dokument
- Föreningsstruktur
- Spelarprofiler
- Säsongsplanering

Det viktigaste är att tjänsten sparar tid för tränare, ledare och föreningar.

---

# Övergripande mål

Bygg tjänsten som en tydlig och flexibel plattform där man kan ha:

Förening → Sektion/Idrott → Lag/Grupp → Spelare/Utövare → Ledare/Föräldrar

Tjänsten ska inte vara låst till en enda sport.  
Den ska vara sportneutral i grunden, men kunna anpassas för olika idrotter.

Exempel på sporter:
- Fotboll
- Innebandy
- Handboll
- Basket
- Ishockey
- Gymnastik
- Friidrott
- Dans
- Kampsport

---

# Viktig produktprincip

Bygg inte en rörig app med massor av separata funktioner.

Kalendern bör vara navet.

Från en träning eller match ska man kunna se:
- Vilka kommer?
- Vad ska aktiviteten innehålla?
- Vilka övningar ingår?
- Vilket material behövs?
- Vilka anteckningar finns?
- Vilka meddelanden gäller?
- Hur blev närvaron?

---

# Roller och behörigheter

Skapa eller planera stöd för roller:

## Admin/Förening
Kan hantera hela föreningen, lag, användare, inställningar och behörigheter.

## Tränare
Kan planera träningar, skapa övningar, använda taktiktavla, kalla spelare och skriva tränaranteckningar.

## Lagledare
Kan hantera kalender, kallelser, närvaro och praktisk information.

## Spelare/Utövare
Kan se schema, kallelser, övningar, uppgifter och eventuell personlig feedback.

## Förälder/Vårdnadshavare
Kan se barnets schema, kallelser, betalningsinfo, cupinfo och praktiska meddelanden.

## Gäst
Begränsad åtkomst.

Viktigt:
- Föräldrar ska inte kunna se interna tränaranteckningar.
- Spelare ska inte kunna ändra kalender.
- Ledare ska bara se sina lag om de inte är föreningsadmin.
- Medicinsk eller känslig information ska vara extra skyddad.
- Bygg med GDPR-tänk från början.

---

# MVP – första prioritet

Börja med att bygga eller strukturera projektet kring dessa delar:

1. Förening/lag/roller
2. Kalender
3. Kallelser och närvaro
4. Träningsplanering
5. Övningsbank
6. Interaktiv taktiktavla
7. Meddelanden/utskick
8. Mobilvänligt gränssnitt

Om projektet redan har någon av dessa delar, förbättra eller koppla ihop dem.

---

# Must have-funktioner

## 1. Lag- och medlemsstruktur

Det ska gå att skapa:
- Förening
- Sektion/idrott
- Lag/grupp
- Spelare/utövare
- Ledare
- Föräldrar/vårdnadshavare

Exempelstruktur:

Astrelia IF  
→ Fotboll  
→ F12  
→ Spelare, tränare, föräldrar

Varje lag bör kunna ha:
- Namn
- Sport
- Åldersgrupp
- Säsong
- Tränare
- Spelare
- Föräldrar
- Kalender
- Övningar
- Dokument
- Inställningar

---

## 2. Kalender och schema

Kalendern ska kunna innehålla:
- Träningar
- Matcher
- Cuper
- Möten
- Lagaktiviteter
- Deadline för betalningar eller anmälningar
- Samlingstid
- Plats
- Omklädningsrum/info
- Ansvarig ledare

Bra funktioner:
- Återkommande träningar
- Kalender per lag
- Kalender per förening
- Synk/export till Google/Apple Calendar längre fram
- Automatisk påminnelse längre fram

---

## 3. Kallelser och närvaro

För varje träning eller match ska man kunna kalla spelare/utövare.

Svarsalternativ:
- Kommer
- Kommer inte
- Kanske
- Ej svarat

Kommentarer bör stödjas, till exempel:
- Kommer sent
- Skadad
- Behöver skjuts
- Kan bara vara med halva tiden

Tränare/ledare ska kunna se:
- Hur många kommer?
- Vilka saknas?
- Vilka har inte svarat?
- Närvarohistorik
- Närvaro per spelare
- Närvaro per aktivitet

---

## 4. Träningsplanering

För varje träning bör man kunna skapa ett träningspass med:
- Datum och tid
- Tema
- Fokusområde
- Uppvärmning
- Huvudövningar
- Spel/matchmoment
- Nedvarvning
- Material som behövs
- Anteckningar
- Kopplade övningar
- Tidsfördelning

Exempel:

Träning 14 maj – Fokus: passningsspel

| Del | Tid | Innehåll |
|---|---:|---|
| Uppvärmning | 10 min | Rondo |
| Övning 1 | 20 min | Passning i triangel |
| Övning 2 | 25 min | Spelvändningar |
| Matchspel | 25 min | 6v6 med två touch |
| Avslut | 10 min | Stretch/reflektion |

Funktioner:
- Skapa träningspass
- Koppla övningar till pass
- Kopiera tidigare pass
- Spara pass som mall
- Markera material som behövs
- Skriva reflektion efter passet

---

## 5. Övningsbank

Varje övning bör ha:
- Namn
- Idrott
- Ålder/nivå
- Syfte
- Instruktioner
- Tidsåtgång
- Antal deltagare
- Material
- Bild/diagram
- Video längre fram
- Variationer
- Svårighetsgrad
- Taggar

Exempel på taggar:
- Uppvärmning
- Passning
- Försvar
- Anfall
- Kondition
- Teknik
- Koordination
- Målvakt
- Kommunikation
- Samarbete

Det ska gå att:
- Skapa egna övningar
- Söka i övningsbanken
- Filtrera efter sport, nivå, taggar och tidsåtgång
- Favoritmarkera övningar
- Koppla övningar till träningspass

---

## 6. Interaktiv taktiktavla

Taktiktavlan är en viktig wow-feature.

Grundfunktioner:
- Visa olika planlayouter
- Flytta spelare/markörer
- Rita linjer
- Rita pilar
- Rita zoner
- Spara taktiker
- Skapa formationer
- Dela taktiker med laget
- Skapa flera steg/sekvenser

Sportytor att stödja på sikt:
- Fotbollsplan
- Innebandyplan
- Handbollsplan
- Basketplan
- Ishockeyrink
- Volleybollplan
- Tennis/padel
- Fri yta

Börja enkelt:
- En generisk plan/yta
- Spelarmarkörer
- Rita pilar/linjer
- Spara/ladda taktiktavlor

---

## 7. Kommunikation

Tjänsten ska minska behovet av Messenger, sms, mail och Facebookgrupper.

Funktioner:
- Lagnyheter
- Meddelanden
- Viktiga utskick
- Kommentarer på kallelser
- Grupptrådar/chatt längre fram
- Meddelande till specifika roller

Mottagargrupper:
- Endast tränare
- Alla föräldrar
- Alla spelare
- Endast kallade till match
- Hela föreningen
- Specifika lag

---

## 8. Dokument och filer

Föreningen/laget ska kunna samla viktiga dokument:
- Policys
- Spelschema
- Cupinformation
- Föräldrainfo
- Lagkassa
- Träningsmaterial
- Matchstrategier
- Medicinska blanketter
- Kontaktlistor
- Sponsormaterial

Funktioner:
- Mappar
- Filuppladdning längre fram
- Behörigheter
- Koppling till lag/förening/aktivitet

---

## 9. Match- och tävlingshantering

För matcher/tävlingar:
- Motståndare
- Plats
- Samlingstid
- Laguttagning
- Positioner/roller
- Resultat
- Statistik
- Matchanteckningar
- Spelarfeedback
- Domare
- Transport/skjuts

För lagidrotter bör laguttagning finnas.

---

## 10. Spelar-/utövarprofil

Varje utövare bör kunna ha:
- Namn
- Kontaktuppgifter
- Föräldrakontakt
- Tröjnummer
- Position/roll
- Allergier/medicinsk info med begränsad behörighet
- Närvaro
- Utvecklingsmål
- Anteckningar från tränare

---

## 11. Betalningar och avgifter

Kan vara senare version, men planera datamodellen för:
- Medlemsavgifter
- Träningsavgifter
- Cupavgifter
- Lagkassa
- Fakturor
- Påminnelser
- Vem har betalat?

Första versionen kan ha:
- Enkel avgiftsstatus
- Manuell markering som betald
- Export längre fram

---

## 12. Mobilvänlighet

Designa mobile first.

Tränaren ska kunna stå på planen och använda mobilen för att:
- Se dagens träning
- Bocka av närvaro
- Öppna övningar
- Se materiallista
- Skicka akut information
- Öppna taktiktavla
- Göra korta anteckningar

---

# Should have-funktioner

## Statistik och uppföljning

Exempel:
- Närvaro per spelare
- Närvaro per träning
- Träningsbelastning
- Matchstatistik
- Utvecklingsområden
- Antal träningar per månad
- Mest använda övningar
- Skador/frånvaro

För ungdomslag bör detta hållas mjukt och pedagogiskt.

Använd gärna begreppet "utvecklingslogg" istället för hård prestationsstatistik.

---

## Mallar

Mallar sparar tid.

Mallar för:
- Träningspass
- Matchkallelser
- Veckoschema
- Föräldramejl
- Cupinformation
- Utvecklingssamtal
- Lagmöten
- Säsongsplanering

---

## Säsongsplanering

Det ska gå att planera:
- Säsongsmål
- Perioder
- Temaveckor
- Matcher/cuper
- Träningsfokus
- Tester/uppföljningar

Exempel:

| Period | Fokus |
|---|---|
| Januari–februari | Grundteknik |
| Mars–april | Spelförståelse |
| Maj–juni | Matchförberedelse |
| Augusti | Uppstart efter sommar |
| September–oktober | Presspel och avslut |

---

## Material- och utrustningslista

Funktioner:
- Inventarielista
- Vem har vad?
- Lånat/återlämnat
- Storlekar på matchställ
- Beställningsbehov
- Skadad/saknad utrustning

---

## Plats- och anläggningsbokning

Funktioner:
- Bokade tider
- Plan/hall
- Krockvarning
- Ansvarigt lag
- Delade resurser

---

## Publik föreningssida

En publik sida kan innehålla:
- Om föreningen
- Nyheter
- Lag
- Kontakt
- Träningstider
- Sponsorloggor
- Börja spela-formulär
- Kalender
- Lediga platser

Detta kan göra tjänsten till en lätt hemsidebyggare för föreningar.

---

# Fun to have-funktioner

## AI-assisterad träningsplanering

Exempelprompt:

"Skapa ett 90-minuterspass för F12 fotboll med fokus på passningar och spelbarhet. 18 spelare, halvplan, 6 koner och 8 bollar."

AI kan föreslå:
- Uppvärmning
- Övningar
- Tidsplan
- Material
- Anpassningar
- Svårare/lättare variationer

---

## Videoanalys

Funktioner:
- Ladda upp matchfilm
- Klippa sekvenser
- Tagga spelare
- Rita på video
- Kommentera situationer
- Dela klipp med laget
- Skapa spellistor, exempelvis "bra press", "omställningar", "försvarsmisstag"

Spara detta till senare eftersom det kan bli tekniskt tungt.

---

## Gamification

För barn och ungdomar:
- Träningsmärken
- Närvarostreaks
- Utmaningar
- Lagmål
- Veckans fokus
- Personliga mål
- Fair play-poäng
- Belöningar utan tävlingshets

Exempel:
"Den här veckan: 50 passningar med vänster fot hemma."

---

## Föräldra-dashboard

Föräldrar ska kunna se:
- Kommande träningar
- Kallelser
- Betalningar
- Skjutslista
- Cupinfo
- Packlista
- Kontakt till ledare
- Vad laget tränade på idag
- Tips att öva hemma

---

## Skjuts- och samåkning

Funktioner:
- Behöver skjuts
- Har platser i bil
- Samlingsplats
- Vem åker med vem?
- Automatisk lista

---

## Cup- och lägerläge

Funktioner:
- Packlista
- Schema
- Boende
- Måltider
- Matchtider
- Kartor
- Kontaktpersoner
- Nödkontakter
- Betalningsstatus
- Samlingar
- Pushnotiser

---

## Sponsor- och ekonomiportal

Funktioner:
- Sponsorregister
- Avtal
- Fakturastatus
- Loggor
- Sponsorpaket
- Synlighet på hemsidan
- Automatiska tackmejl
- Statistik över exponering

---

## Klubbshop

Funktioner:
- Matchkläder
- Träningskläder
- Supporterprodukter
- Beställningslistor
- Storleksinsamling
- Integration med leverantör längre fram

---

# Teknisk prioritering

Arbeta i tre steg.

## Steg 1: Lagvardag

Fokus på sådant som alla föreningar behöver varje vecka:
- Kalender
- Kallelser
- Närvaro
- Meddelanden
- Lag/roller

## Steg 2: Tränarverktyg

Det som gör tjänsten unik:
- Träningsplanering
- Övningsbank
- Taktiktavla
- Mallar
- Säsongsplanering

## Steg 3: Föreningsplattform

Det som gör att hela föreningen vill betala:
- Publik hemsida
- Dokument
- Avgifter
- Sponsorhantering
- Statistik
- Cup/lägerläge
- AI
- Video

---

# Rekommenderad arbetsgång för Claude

Börja här:

## Steg A – Projektanalys
1. Läs projektets filstruktur.
2. Identifiera ramverk, språk och datalager.
3. Identifiera befintliga sidor, komponenter, modeller och API-routes.
4. Skriv en kort sammanfattning av hur projektet är byggt.
5. Skapa en TODO-lista.

## Steg B – Datamodell
Planera eller skapa modeller för:
- Organization / Club
- SportSection
- Team
- User
- Member / Athlete
- Guardian
- Role / Permission
- Activity / Event
- Attendance
- TrainingSession
- Drill / Exercise
- TacticalBoard
- Message / Announcement
- Document
- Match
- PaymentStatus

## Steg C – Navigering och struktur
Skapa en tydlig appstruktur:
- Dashboard
- Förening
- Lag
- Kalender
- Träningar
- Övningar
- Taktiktavla
- Meddelanden
- Dokument
- Inställningar

## Steg D – MVP-funktioner
Implementera i denna ordning:
1. Grundlayout och dashboard
2. Förening och lag
3. Kalender/aktiviteter
4. Kallelser och närvaro
5. Träningspass
6. Övningsbank
7. Enkel taktiktavla
8. Meddelanden/utskick
9. Mobilanpassning

## Steg E – Test och kvalitet
Efter varje större ändring:
- Kör build
- Kör lint
- Kör tester om de finns
- Kontrollera TypeScript-fel om projektet använder TypeScript
- Kontrollera att UI fungerar responsivt
- Dokumentera vad som gjorts

---

# UI/UX-riktning

Designen ska kännas:
- Modern
- Tydlig
- Enkel
- Professionell
- Mobilvänlig
- Föreningsvänlig
- Inte för teknisk

Undvik:
- För många menyer
- För mycket text på samma sida
- Röriga tabeller på mobil
- Funktioner som kräver många klick

Bra princip:
En stressad tränare ska kunna använda detta fem minuter innan träningen börjar.

---

# Viktiga vyer

## Dashboard
Visa:
- Dagens aktiviteter
- Kommande träningar
- Obesvarade kallelser
- Senaste meddelanden
- Snabbknappar

Snabbknappar:
- Skapa träning
- Skapa match
- Skapa övning
- Skicka meddelande
- Öppna taktiktavla

## Lagvy
Visa:
- Laginfo
- Spelare
- Ledare
- Kalender
- Närvaro
- Senaste meddelanden
- Dokument

## Träningsvy
Visa:
- Datum/tid/plats
- Tema
- Närvaro
- Övningar
- Material
- Anteckningar
- Reflektion efteråt

## Övningsbank
Visa:
- Sök
- Filter
- Kort/lista med övningar
- Skapa ny övning
- Favoriter

## Taktiktavla
Visa:
- Sportyta
- Spelarmarkörer
- Ritverktyg
- Spara/ladda
- Rensa tavla
- Dela/exportera längre fram

---

# Slutmål

Bygg en sporthub där tränaren, föreningen, spelaren och föräldern får en tydlig vardag.

Tjänstens kärnor är:

1. Administration  
Kalender, kallelser, närvaro, medlemsstruktur.

2. Träning  
Övningar, träningspass, taktiktavla, utveckling.

3. Förening  
Kommunikation, dokument, betalningar, hemsida.

Prioritera tydlighet, återanvändning och behörigheter.
