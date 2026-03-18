/**
 * Extra basketball exercises sourced from well-known training resources such as
 * USA Basketball (usab.com), NBA coaching clinics, and Swedish Basketball Federation
 * (basketboll.se) coaching materials. These exercises supplement the year-based
 * season plans and appear in the Övningsbank in the training database.
 */

import type { Activity } from "./types";

export interface ExtraExercise extends Activity {
  /** Source / recommended age group as guidance. */
  ageGroup?: string;
  /** Source label shown in the exercise bank. */
  source?: string;
}

export const extraExercises: ExtraExercise[] = [
  // ─── Uppvärmning ──────────────────────────────────────────────────────────
  {
    name: "Rörelserutiner med boll",
    description:
      "Spelarna joggar runt planen i en stor cirkel och utför rörelser med bollen på kommando: dribbla med höger hand, dribbla med vänster hand, håll bollen högt, kasta bollen upp och fånga, dribbla under benet. Tränaren varierar kommandona var 15:e sekund.",
    tips:
      "Håll tempot uppe och se till att spelarna lyfter blicken under dribbling. Rörelserutiner med boll är ett effektivt sätt att aktivera kroppen och simultaneously repetera grundläggande bollhantering.",
    durationMinutes: 8,
    intensityLevel: 1,
    tags: ["uppvärmning", "dribbling"],
    source: "Basketboll.se",
  },
  {
    name: "Dynamisk uppvärmning",
    description:
      "Spelarna genomför en strukturerad dynamisk uppvärmning längs planen: knälyft, hälspark, sidsteg, korsstegsdiagonaler, hopp på ett ben, och sprintaccelerationer på 10 m. Varje rörelse utförs i 2 set längs planens längsida (28 m).",
    tips:
      "Dynamisk uppvärmning förbereder muskler och leder för basketspecifika rörelser och minskar skaderisk. Undvik statisk stretching före träning.",
    durationMinutes: 10,
    intensityLevel: 1,
    tags: ["uppvärmning"],
    source: "USA Basketball",
  },
  {
    name: "Parvis dribblinguppvärmning",
    description:
      "I par med en boll var: en spelare dribblar framåt på sin halva och den andre speglar rörelsen bakåt utan boll. Byts roller efter 30 sekunder. Avancering: partnern försöker störa/nå bollen medan dribblar rör sig framåt.",
    tips:
      "Fokus på kroppsskydd och dribblingskontroll. Spelaren med boll ska använda kroppen för att skydda bollen.",
    durationMinutes: 6,
    intensityLevel: 1,
    tags: ["uppvärmning", "dribbling"],
    source: "NBA Coaching Clinic",
  },

  // ─── Dribbling ─────────────────────────────────────────────────────────────
  {
    name: "Stationärt dribblingspaket",
    description:
      "Spelarna övar 5 dribblingsmoment stationärt, vardera i 30 sekunder: 1) Låg kontrolldrivel, 2) Hög dribbel, 3) Korshanddribbel (crossover), 4) Handbyte bakom ryggen, 5) Handbyte under benet. Vila 10 sek mellan momenten.",
    tips:
      "Påminn spelarna om att hålla kroppen låg med knäna lätt böjda. Fingertopparna styr bollen, inte handflatan.",
    durationMinutes: 8,
    intensityLevel: 1,
    tags: ["dribbling", "teknik"],
    source: "USA Basketball",
  },
  {
    name: "Dribblingshindersbana",
    description:
      "Placera ut 6–8 koner i slalom längs planen. Spelarna dribblar runt konerna med höger hand på ena sidan, vänster hand på andra. Avancering: byt hand vid varje kon (crossover), dribbla baklänges, eller tidtagning för tävlingsmoment.",
    tips:
      "Viktigt att spelarna inte tittar ner på bollen när de passerar konerna. Uppmuntra blicken uppåt som i matchsituationer.",
    durationMinutes: 10,
    intensityLevel: 2,
    tags: ["dribbling", "teknik"],
    source: "Basketboll.se",
  },
  {
    name: "Två-bolls dribbling",
    description:
      "Spelarna dribblar med två bollar simultant: a) Båda bollarna studsar samtidigt, b) Alternerande studs (vänster-höger), c) En hög och en låg studs, d) Röra sig framåt och bakåt. Varje variant 30 sekunder.",
    tips:
      "Svårt men mycket effektivt för att träna självständig kontroll med varje hand. Börja stationärt och rör er sedan framåt. Acceptera att det tar tid.",
    durationMinutes: 8,
    intensityLevel: 2,
    tags: ["dribbling", "teknik"],
    source: "NBA Coaching Clinic",
  },
  {
    name: "Dribbling i rörelsemönster",
    description:
      "Spelarna dribblar i ett fördefinierat rörelsemönster: sprint till frikastlinjen → crossover → sprint till mittlinjen → bakom-rygg-handbyte → sprint till motsatt frikastlinje → under-benet-handbyte → läggning. Upprepas från motsatt håll.",
    tips:
      "Koppla dribblingsmoment till matchrelevanta förflyttningar. Handbyten ska ske snabbt och med låg boll.",
    durationMinutes: 10,
    intensityLevel: 2,
    tags: ["dribbling", "teknik"],
    source: "USA Basketball",
  },

  // ─── Skytte ────────────────────────────────────────────────────────────────
  {
    name: "Form-shooting stationärt",
    description:
      "Spelarna ställer sig 1–2 meter från korgen och övar skotteknik: BEEF (Balance, Eyes, Elbow, Follow-through). 20 skott per spelare med fokus på korrekt form, inte distans. Tränaren observerar och ger individuell feedback.",
    tips:
      "BEEF-metoden: Balance = fötterna axelbrett isär, Eyes = titta på framkanten av korgen, Elbow = armbågen under bollen, Follow-through = handleden framåt som du winkar. Minska avstånd om tekniken brister.",
    durationMinutes: 8,
    intensityLevel: 1,
    tags: ["skytte", "teknik"],
    source: "USA Basketball",
  },
  {
    name: "Elva-punkt skottövning",
    description:
      "Koner placeras i en halvcirkel runt korgen (11 punkter): raka fronten, 45-grader vänster/höger, sidorna, hörnen samt baslinje. Spelaren tar ett skott från varje position, börjar närmast korgen och rör sig ett steg bort om man träffar. Vinner den som hinner längst ut.",
    tips:
      "Fokus på att inte ändra skotteknik beroende på vinkel. Gör 3–4 rundor per spelare. Mätbart och motiverande för spelarna att följa sin progression.",
    durationMinutes: 12,
    intensityLevel: 1,
    tags: ["skytte"],
    source: "Basketboll.se",
  },
  {
    name: "Catch-and-shoot från pass",
    description:
      "I par: en spelare är passare och en skyttare. Skyttaren rör sig till markerade punkter runt trepunktslinjen, tar emot en pass och skjuter direkt (utan extra dribbel). 10 skott per position, 4 positioner. Byt roller.",
    tips:
      "Fötterna ska vara i skottposition redan innan bollen tas emot (shot-ready stance). Viktigt att skyttaren kommunicerar 'klar' med handen.",
    durationMinutes: 15,
    intensityLevel: 2,
    tags: ["skytte", "passning"],
    source: "NBA Coaching Clinic",
  },
  {
    name: "Hoppa och skjut (midsection shooting)",
    description:
      "Spelaren börjar med bollen vid höften (triple-threat position), gör ett shot-fake (fejk), lyfter bollen och skjuter med hoppet. Genomförs från frikastlinjen och 45-graders vinklar. 15 skott per position.",
    tips:
      "Shot fake ska vara övertygande och ske med en riktig boll-till-ansikte-rörelse, inte bara en svaj. Spelaren ska landa på samma plats som de startade.",
    durationMinutes: 10,
    intensityLevel: 2,
    tags: ["skytte", "teknik"],
    source: "USA Basketball",
  },

  // ─── Passning ──────────────────────────────────────────────────────────────
  {
    name: "Grundpassningar i par",
    description:
      "Par med en boll övar 4 grundpassningar, vardera i 1 minut: 1) Bröspass (chest pass), 2) Studsboll (bounce pass), 3) Överhandpass (overhead pass), 4) Basebollpass (baseball pass) på avstånd. Fokus på fingersättning, kropp och mottagningsteknik.",
    tips:
      "Vid bröspass: tumme neråt i slutrörelsen, bollen ska träffa partnern vid bröst/midja. Studsbollen ska studsa upp till partnerens midja. Fånga med fingertopparna, inte handflatan.",
    durationMinutes: 8,
    intensityLevel: 1,
    tags: ["passning", "teknik"],
    source: "Basketboll.se",
  },
  {
    name: "Tre-man-weave",
    description:
      "Tre spelare radas upp: en i mitten och en på varje sida. Mittersta passar till en sida och springer bakom den spelaren. Den spelaren passar vidare och springer bakom näste. Fortsätter längs planen tills man når den andra korgen för läggning. Återvänder på samma sätt.",
    tips:
      "Klassisk basketövning som tränar passning, kommunikation och rörelse utan boll. Spelarna ska ropa 'klar!' innan de tar emot pass. Börja långsamt, öka tempo.",
    durationMinutes: 12,
    intensityLevel: 2,
    tags: ["passning", "teknik"],
    source: "USA Basketball",
  },
  {
    name: "Passningsmönster i rörelse",
    description:
      "Fem spelare i ett 3-2 motionsmönster passar bollen runt i fördefinierat mönster: toppen till vingen, vingen ner till hörnet, hörnet tillbaka till hörnspjutsen, och cross-court. Inga dribbel tillåtna. Övningen flödar 2 minuter, sedan byt rotation.",
    tips:
      "Tränar passningsflöde och rörelse utan boll. Spelarna ska ropa sina positioner och vara i rörelse innan de tar emot pass. Fokus på timing.",
    durationMinutes: 10,
    intensityLevel: 2,
    tags: ["passning", "taktik"],
    source: "NBA Coaching Clinic",
  },

  // ─── Försvar ───────────────────────────────────────────────────────────────
  {
    name: "Försvarsposition och glidsteg",
    description:
      "Spelarna övar defensiv grundposition: fötterna axelbrett isär, knän böjda, rygg rak, händerna upp i defensive stance. Sedan glidsteg (defensive slides) i sidled: 5 steg åt höger, 5 steg åt vänster. Upprepa 5 gånger. Avancering: på kommando byta riktning snabbt.",
    tips:
      "Glidsteg: fötterna ska aldrig korsas. Den yttre foten drar den inre foten mot sig. Kryp inte ihop – håll kroppen uppe och redo.",
    durationMinutes: 8,
    intensityLevel: 1,
    tags: ["försvar", "teknik"],
    source: "Basketboll.se",
  },
  {
    name: "1 mot 1 försvar med cones",
    description:
      "Placera ut en kon som 'boll-mål'. Angreppsspelaren dribblar mot konen och försvarsspelaren ska styra angriparen bort. Fokus på footwork och hålla försvarspositionen. 60 sekunder per par, sedan byt roller.",
    tips:
      "Försvarsspelaren ska styra angriparen åt svag sida (bort från handen). Påminn om att försvara med fötterna, inte händerna. Händerna är till för att störa, inte att slå bollen.",
    durationMinutes: 10,
    intensityLevel: 2,
    tags: ["försvar"],
    source: "USA Basketball",
  },
  {
    name: "Blockout och retur",
    description:
      "Tränaren skjuter mot korgen (avsiktligt missar). Försvarsspelaren blockerar ut offensiv spelare med korrekt teknik (pivot och kropp-kontakt), fångar returen. Angriparen försöker ta returen. 10 repetitioner per par, sedan byt roller.",
    tips:
      "Blockout-teknik: rotera mot angriparen med en pivotsteg, sätt kroppen mot angriparen med armarna ut. Mål: hitta kontakten innan du söker bollen.",
    durationMinutes: 10,
    intensityLevel: 2,
    tags: ["försvar", "teknik"],
    source: "NBA Coaching Clinic",
  },

  // ─── Matchspel ─────────────────────────────────────────────────────────────
  {
    name: "3 mot 2, 2 mot 1",
    description:
      "3 anfallsspelare mot 2 försvarare spelar ner till ena korgen. Om försvararna stjäl/stoppar går 2 av anfallsspelarna och en av försvararna ner i 2 mot 1 till motsatt korg. Kontinuerligt i 5 minuter.",
    tips:
      "Tränar överspel i anfall och eftersättning i försvar. Anfallslaget ska utnyttja numerärt övertag med snabba, beslutsamma pass. Försvarslaget ska forcera ut spelarna.",
    durationMinutes: 10,
    intensityLevel: 3,
    tags: ["matchspel", "taktik", "passning"],
    source: "Basketboll.se",
  },
  {
    name: "5 mot 5 halfcourt matchspel",
    description:
      "Fullständigt 5 mot 5 halfcourt med regler: ingen full-court press, anfallslagen har 30 sekunder att skjuta. Förloraren byts ut och nästa lag väntar på sidan. Vinnaren stannar kvar upp till 3 matcher i rad.",
    tips:
      "Tränaren stoppar spelet för coachingmoment (time-out) max 3 gånger per halvlek. Fokus på vad man arbetar med den specifika träningspasset.",
    durationMinutes: 20,
    intensityLevel: 3,
    tags: ["matchspel"],
    source: "USA Basketball",
  },
  {
    name: "Transitionsspel 4 mot 4",
    description:
      "4 mot 4 på full plan. Varje gång laget byter från försvar till anfall (efter stulen boll, retur eller gjort poäng) måste de springa bakom baslinjen och angripa från andra hållet. Tränar snabb transition och tempobyte.",
    tips:
      "Primärt mål: spela snabbt i transition (3–4 pass maxalt). Sekundärt mål: öva defensiv rotation vid transition. Ge poängsystem för snabba transtionpoäng (under 5 sekunder = 2 poäng).",
    durationMinutes: 15,
    intensityLevel: 3,
    tags: ["matchspel", "taktik"],
    source: "NBA Coaching Clinic",
  },

  // ─── Teknik ────────────────────────────────────────────────────────────────
  {
    name: "Pivotteknik",
    description:
      "Spelarna lär sig tre typer av pivot: framåtpivot (forward pivot), bakåtpivot (reverse pivot) och crossover-pivot. Varje typ övas stationärt i 2 minuter. Avancering: pivot in i dribbel, pivot till skott, pivot till pass.",
    tips:
      "Pivotfoten (den fot du inte lyfter) är avgörande. Bollen ska ligga nära kroppen under pivot för att undvika stolning. Kroppen låg, balans.",
    durationMinutes: 10,
    intensityLevel: 1,
    tags: ["teknik"],
    source: "USA Basketball",
  },
  {
    name: "Läggningsrutiner",
    description:
      "Spelarna övar korrekta läggningssteget (right-hand layup): dribbel, pick up vid cirkeln, 1-2 steg (höger-vänster), lyft och lägg mot plankan. 10 repetitioner höger sida, 10 vänster sida, 10 valfri sida under press. Fokus på mjuk avslutning.",
    tips:
      "Kontrollera att spelarna lyfter rätt knä (motsatt sida mot handen). Bollen läggs mot bakre delen av den fyrkantiga markeringen på plankan. Sikta på rutan, inte ringen.",
    durationMinutes: 12,
    intensityLevel: 1,
    tags: ["teknik", "skytte"],
    source: "Basketboll.se",
  },
  {
    name: "Finter och genombrott",
    description:
      "Spelarna övar 3 grundläggande finter: 1) Shot fake (fejkskott), 2) Pass fake (fejkpass), 3) Jab step (hot-step). Varje fint övas stationärt sedan i rörelse 1 mot 0 och slutligen 1 mot 1. 5 repetitioner per fint.",
    tips:
      "En övertygande fint kräver full rörelse (lyfta bollen, böja knäna) – halv fint fungerar inte mot bra försvarare. Lägg tid på att göra fejkrörelserna trovärdiga.",
    durationMinutes: 12,
    intensityLevel: 2,
    tags: ["teknik", "matchspel"],
    source: "NBA Coaching Clinic",
  },

  // ─── Taktik ────────────────────────────────────────────────────────────────
  {
    name: "Enkel zonoffensiv mot 2-3",
    description:
      "Laget lär sig grundläggande attack mot 2-3 zon: snabba pass, spela in i mitten, spelaren i fri lucka under gett ett skottmöjlighet. Börja med genombandning (walk-through) utan försvar, sedan mot passivt försvar.",
    tips:
      "Mot zonen gäller: passa snabbt för att röra på zonen, håll ihop i offensivpositioner, spela in i 'the gap' (lucka i zonen). Undvik att hålla bollen länge.",
    durationMinutes: 15,
    intensityLevel: 2,
    tags: ["taktik", "matchspel"],
    source: "Basketboll.se",
  },
  {
    name: "Enkel pick-and-roll",
    description:
      "Grundläggande pick-and-roll: screensättaren sätter en screen för bollhållaren. Bollhållaren läser försvarsspelarna och väljer: 1) Skjut om försvararen byter, 2) Passa till screensättaren om han rullar fri, 3) Gå till hållet om försvararen stockar sig.",
    tips:
      "Screensättaren ska vara stilla i kontaktmomentet och sedan rulla mot korgen. Bollhållaren ska 'läsa' vad försvararna gör. Börja med genombandning, öka sedan till spel.",
    durationMinutes: 15,
    intensityLevel: 2,
    tags: ["taktik", "teknik"],
    source: "USA Basketball",
  },
  {
    name: "Pressforsvar och presskick",
    description:
      "Laget övar full-court press: man-man press längs hela planen. Incastaren försöker spela in, pressingslagen försöker pressa och forcera turnover. Sedan övar laget hur man bryter en press: spalning, snabba pass, rörelse utan boll.",
    tips:
      "Presskick: ett spelare rusar mot bollen för att tidspressa. En annan täcker kortet. Kommunikation är avgörande. Mot pressbrottet: spela lugnt, passa inte i närkamp, använd hela planen.",
    durationMinutes: 15,
    intensityLevel: 3,
    tags: ["taktik", "försvar"],
    source: "NBA Coaching Clinic",
  },

  // ─── Kondition ─────────────────────────────────────────────────────────────
  {
    name: "Suicidesprints (linjesprints)",
    description:
      "Spelarna startar vid baslinjen och springer till frikastlinjen och tillbaka, till mittlinjen och tillbaka, till motsatt frikastlinje och tillbaka, till motsatt baslinje och tillbaka. Det är en 'suicide'. Gör 3–5 suicides med 60 sekunder vila mellan varje.",
    tips:
      "Klassisk basketkonditionsövning. Peaka hur snabbt varje spelare tar sig igenom och utmana dem att förbättra sin tid. Fokus på att röra fötterna snabbt vid varje linje.",
    durationMinutes: 12,
    intensityLevel: 3,
    tags: ["kondition"],
    source: "USA Basketball",
  },
  {
    name: "Intervallöpning basketplan",
    description:
      "Spelarna springer 8 stafettsprints (varje omgång = hela planens längd, 28 m) med 15 sekunders vila mellan varje. Vila 2 minuter, gör sedan ett andra set. Tidtagning uppmuntrar maximal ansträngning.",
    tips:
      "Intervallöpning efterliknar basketens krav med intensiva sprinter och korta viloperioder. Tryck på att spelarna verkligen sprintar – det är inte en jogg.",
    durationMinutes: 10,
    intensityLevel: 3,
    tags: ["kondition"],
    source: "Basketboll.se",
  },
];
