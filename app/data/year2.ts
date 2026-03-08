import type { SeasonPlan } from "./types";

export const year2Plan: SeasonPlan = {
  year: 2,
  ageGroup: "8 år",
  description:
    "Andra säsongen bygger vidare på grunderna och introducerar mer specifika basketfärdigheter. Barnen börjar förstå spelet och lär sig röra sig bättre med och utan bollen.",
  goals: [
    "Förbättra studs med båda händerna",
    "Lära sig chest pass och bounce pass",
    "Introducera enkel läggning",
    "Försvarsgrunder – stance och slide",
    "Förstå enkel speltaktik och positioner",
    "Spela minibasket 3v3 och 4v4",
  ],
  months: [
    {
      month: "September",
      focus: "Bygga på grunderna – studs och passningar",
      practices: [
        {
          session: 1,
          theme: "Välkommen tillbaka – uppstart",
          warmup: "Sprint-tag: En person är 'det', springer och taggar. Den som taggas hjälper till att jaga.",
          drills: [
            "Studs-test: Studsa med höger hand 20 gånger, byta till vänster. Notera skillnaden.",
            "Kontrollstuds: Studsa bollen lågt utan att titta ned.",
            "Crossover: Studsa från höger till vänster hand (introduktion).",
            "Boll-hantering: Rulla bollen runt midjan, under benen och bakom ryggen.",
          ],
          game: "Studs-king: Alla studsar sin boll i en yta, försök peta andras utan att tappa sin.",
          cooldown: "Sträck ut armarna, ben och axlar. Prata om säsongens mål.",
        },
        {
          session: 2,
          theme: "Passningsskolan",
          warmup: "Boll-fångstleken: Kasta bollen upp, klappa händerna och fånga. Öka antalet klappar.",
          drills: [
            "Chest pass: Teknikgenomgång – steg framåt, skjut med fingrarna.",
            "Bounce pass: Studsa bollen till partnern (studsen ska vara vid motståndarens midhöjd).",
            "Overhead pass: Kasta från ovan huvudet, bra vid pressad situation.",
            "Passningsstafett: Tre i rad, passa längs linjen snabbt.",
          ],
          game: "Passningskombat: Två lag, passa bollen utan att motståndarnas lag avbryter.",
          cooldown: "Lugn löpning ett varv. Fråga: Vilken passning var svårast?",
        },
        {
          session: 3,
          theme: "Dribbla och titta upp",
          warmup: "Coachen håller upp fingrar – barnen dribblar och ropar ut antalet.",
          drills: [
            "Dribbla och titta på ett mål 5 meter bort.",
            "Snabb riktningsändring: Dribbla, stopp, ny riktning.",
            "Dribbla med svagare hand i 2 minuter (fokus, inte hastighet).",
            "Ändringslopp: Sprint-dribbel – stopp – vändning – ny sprint.",
          ],
          game: "Dribbel-tag: Alla dribblar, en person utan boll försöker stjäla andras bollar.",
          cooldown: "Stretcha fingrar, handleder och underarmar.",
        },
        {
          session: 4,
          theme: "Spela med regler",
          warmup: "Rörelseimitation: Coachen gör en rörelse, barnen imiterar med boll.",
          drills: [
            "Repetition av studs, pass och kast.",
            "Introduktion av 3-stegs-regeln (förklara enkelt, öva utan boll).",
            "Stopp och pivot: Dribbla, stopp, pivotera med ena foten.",
          ],
          game: "3v3 med enkla regler: Steg-fel och double dribble är med nu.",
          cooldown: "Samling: En sak ni lärde er idag. Klapp för laget.",
        },
      ],
    },
    {
      month: "Oktober",
      focus: "Läggning och försvarsfundament",
      practices: [
        {
          session: 5,
          theme: "Högerläggning",
          warmup: "Hopprep-imitation (utan rep): Hoppa och få upp pulsen. 2 minuter.",
          drills: [
            "Läggningsrörelse utan boll: Höger fot steget in, höger knä upp, höger hand.",
            "Läggning från stillastående (direkt under korgen).",
            "Två steg in mot korgen och lägg upp (höger sida).",
            "Med boll: Dribbla, ta två steg, lägg upp på tavlan.",
          ],
          game: "Läggningskö: Kö på höger sida, dribbla in och lägg upp. Räkna lagets korgar.",
          cooldown: "Sträck ut knän och höfter. Bra jobbat!",
        },
        {
          session: 6,
          theme: "Vänsterläggning (introduktion)",
          warmup: "Spegel-löpning: Stå mitt för varandra, en leder och den andre speglar.",
          drills: [
            "Läggning utan boll från vänster sida (vänster fot in, vänster knä upp).",
            "Läggning med boll från vänster sida.",
            "Valfri sida läggning: Barnen väljer vilken sida de är bekvämast med.",
          ],
          game: "Runt-korgen-race: Dribbla runt planen, lägg upp på slutet (valfri sida).",
          cooldown: "Stretcha vrister och lår.",
        },
        {
          session: 7,
          theme: "Försvarsposition",
          warmup: "Defensive-slides: Sidsteg i försvarsstance utan att korsa benen.",
          drills: [
            "Athletic stance: Fötter skulderbredd, knäna böjda, ryggen rak.",
            "Ballsida-helpside: Boll-dig-basket-triangle (introduktion).",
            "Skugga: En anfallare dribblar fritt, en försvarare håller sig framför.",
            "Tagga bollen: Försvararen försöker röra bollen utan att foul.",
          ],
          game: "1v1 försvar: Anfallaren startar 5 meter från korgen, försvararen ska stoppa kast.",
          cooldown: "Stretcha höfterna. Fråga: Vad är viktigast för en bra försvarare?",
        },
        {
          session: 8,
          theme: "Förstå offensivt rörelsemönster",
          warmup: "Tre-i-rad-löpning: Tre spelare löper sida vid sida och byter platser vid signal.",
          drills: [
            "V-cut: Röra sig mot försvararen, abrupt ändring – springa mot bollen.",
            "Back-cut: Om försvararen stänger av passningslinjen, skär bakom till korgen.",
            "Öppna dörren: Röra sig till tomt utrymme.",
          ],
          game: "2v2: Fokus på rörelser utan boll och passa till den som klipper.",
          cooldown: "Samling, diskutera vad V-cut är. Klapp.",
        },
      ],
    },
    {
      month: "November",
      focus: "Spelfärdighetsutveckling",
      practices: [
        {
          session: 9,
          theme: "Triple threat",
          warmup: "Bollgymnastik: Rulla, studsa och fånga på olika sätt.",
          drills: [
            "Triple threat-position: Fötterna rätt, knäna böjda, bollen vid höften – redo att dribbla, passa eller kasta.",
            "Från triple threat: Ta ett dribbelsteg och kasta.",
            "Från triple threat: Skjuta direkt (om nära korgen).",
            "Från triple threat: Passa till medspelare.",
          ],
          game: "3v3: Varje attack måste börja från triple threat-position.",
          cooldown: "Frivilliga visar sin bästa triple threat. Klapp!",
        },
        {
          session: 10,
          theme: "Retur (rebound)",
          warmup: "Hopptävling: Vem kan hoppa till den högsta markeringen på väggen?",
          drills: [
            "Box out: Ställa sig framför motståndaren vid kast-situationer.",
            "Hoppa och hämta: Kasta mot tavlan, hoppa och fånga med båda händerna.",
            "Outlet pass: Hämta returen och passa snabbt ut till en medspelare.",
          ],
          game: "Retur-kamp 2v2: Coachen kastar på tavlan, lagen slåss om returen.",
          cooldown: "Stretcha axlar och fingrar.",
        },
        {
          session: 11,
          theme: "Snabbbrytning",
          warmup: "Sprinter: 5x15m sprinter. Vila 30 sekunder mellan.",
          drills: [
            "Snabbbrytning: Hämta retur (eller ta ut från basket) – outlet pass – spring uppåt planen.",
            "3v2 snabbbrytning: Tre anfallare mot två försvarare.",
            "Avsluta snabbbrytning med läggning eller enkelt kast.",
          ],
          game: "Snabbbrytnings-match: Poäng vid snabbbrytningskorg = 2 poäng extra.",
          cooldown: "Lugn promenad. Stretcha lår.",
        },
        {
          session: 12,
          theme: "Kombinationsövningar",
          warmup: "Rörelseövning: Löpsteg, sidsteg, backpedal 10 meter vardera.",
          drills: [
            "Passningstornado: Tre spelare i triangel, passa runt fort.",
            "Dribbla och passa av: Dribbla in, passa till en medspelare.",
            "Catch and shoot: Ta emot pass och kasta direkt.",
          ],
          game: "4v4 med fokus: Passa minst 3 gånger per attack.",
          cooldown: "Samling. Beröm varandra specifikt: 'Du var bra på...'",
        },
      ],
    },
    {
      month: "December",
      focus: "Julbasket och avslutning",
      practices: [
        {
          session: 13,
          theme: "Julbasket-lekar",
          warmup: "Tomtelöpning med boll i hallen.",
          drills: [
            "Julkorgen: Tävling om flest korgar.",
            "Snöbollspass: Alla passar runt till julmusik.",
            "Kreativa lösningar: Vem kan göra den konstigaste men lyckade kastningen?",
          ],
          game: "Jul-turnering: Mini-matcher med julmusik.",
          cooldown: "God jul! Dela ut klistermärken/diplom.",
        },
        {
          session: 14,
          theme: "Höstens bästa stunder",
          warmup: "Favorituppvärmning barnen väljer.",
          drills: [
            "Barnens tre favoritövningar.",
            "Foto-session: Varje barn tar en korgkastningsbild.",
          ],
          game: "Frilek – spela som ni vill!",
          cooldown: "Berättarcirkel: Favoritmomentet från hösten.",
        },
      ],
    },
    {
      month: "Januari",
      focus: "Vårstart – stärk tekniken",
      practices: [
        {
          session: 15,
          theme: "Välkommen tillbaka – teknikcheck",
          warmup: "Uppvärmningslopp runt hallen med bollövningar.",
          drills: [
            "Studs-check: Höger, vänster, crossover.",
            "Pass-check: Chest pass, bounce pass, overhead.",
            "Kast-check: Nära korgen, medeldistans.",
          ],
          game: "3v3 välkomstmatch.",
          cooldown: "Sätt upp mål för vårsäsongen.",
        },
        {
          session: 16,
          theme: "Kroppskontroll och balans",
          warmup: "Balansövning: Stå på ett ben 30 sekunder, byta.",
          drills: [
            "Stopp och balans: Dribbla och stoppa med bra balans (Jump stop).",
            "Pivot: Pivotera utan att tappa balansen.",
            "Catch and balance: Ta emot pass och stabilisera.",
          ],
          game: "1v1 balans-utmaning: Vem kan stanna snabbast?",
          cooldown: "Stretcha.",
        },
      ],
    },
    {
      month: "Februari",
      focus: "Spela smartare",
      practices: [
        {
          session: 17,
          theme: "Läsa spelet",
          warmup: "4-hörnslopp: Spring igenom alla hörn med boll.",
          drills: [
            "Var ska jag vara? Utan boll – hitta öppet utrymme.",
            "Hjälp-försvar: När medspelaren tappar sin man, täck upp.",
            "2-pass regel: Ingen ska hålla bollen mer än 2 sekunder.",
          ],
          game: "4v4: Coachen poängsätter smarta passningar, inte bara korgar.",
          cooldown: "Diskussion: Vad är ett smart spel?",
        },
        {
          session: 18,
          theme: "Pick and roll (enkel)",
          warmup: "Partner-löpning: Spring parallellt, håll avstånd på 2 meter.",
          drills: [
            "Pick (screen): Stå still med bred stance och blockera försvararen.",
            "Roll: Efter pick, dreh mot korgen.",
            "Pick and roll 2v2 (utan försvar): Öva på timing.",
            "Pick and roll 2v2 med svag försvar.",
          ],
          game: "3v3 med pick and roll som poäng-bonus.",
          cooldown: "Lagklapp.",
        },
        {
          session: 19,
          theme: "Frikaststeknik",
          warmup: "Armsträckning och axelrotation.",
          drills: [
            "Frikast-rutin: Samma rörelser varje gång (studs bollen 2 ggr, sikta, kasta).",
            "Frikastkastning: 10 kast per person från frikastlinjen (anpassad distans).",
            "Rörelsefrikas: Dribbla, stopp, frikast.",
          ],
          game: "Frikasttävling: Mest träffar av 10 vinner.",
          cooldown: "Stretcha armar och axlar.",
        },
        {
          session: 20,
          theme: "Spelregler – lär dig mer",
          warmup: "Sprintlek med regler (coachen ropar – ni gör).",
          drills: [
            "Quiz om regler: Vad är steg-fel? Vad är double-dribble? Foul?",
            "Öva på situationer: Ut-på-linjen-inkast.",
            "Öva på situationer: Frikast-situation.",
          ],
          game: "5v5 (om antal tillåter) med alla regler.",
          cooldown: "Klapp. Frågesport om regler.",
        },
      ],
    },
    {
      month: "Mars",
      focus: "Säsongsavslutning",
      practices: [
        {
          session: 21,
          theme: "Spela match",
          warmup: "Laguppvärmning: Sprintvarv, streckning, passning.",
          drills: [
            "Snabb repetition av säsongens tekniker.",
            "Taktikprat: Enkel offensiv och defensiv plan.",
          ],
          game: "Säsongsmatch: Spela fullt ut med alla inlärda regler.",
          cooldown: "Utvärdera matchen – vad gick bra?",
        },
        {
          session: 22,
          theme: "Säsongsfinale",
          warmup: "Barnens favorituppvärmning.",
          drills: [
            "Highlights: Varje barn visar sin bästa teknik.",
            "Sista gruppfoto med bollar!",
          ],
          game: "Storspel: Alla mot alla turnering.",
          cooldown: "Diplomutdelning och årets basket-priser. KLAPP!",
        },
      ],
    },
  ],
};
