import type { SeasonPlan } from "./types";

export const year1Plan: SeasonPlan = {
  year: 1,
  ageGroup: "Upp till 7 år",
  description:
    "Första säsongen fokuserar på glädje, lek och grundläggande motorik. Barnen ska trivas och vilja komma tillbaka. Inga krav på teknisk perfektion – vi leker med bollen!",
  goals: [
    "Skapa glädje och kärlek för basket",
    "Grundläggande koordination och motorik",
    "Lära sig bolla och kasta mot korgen",
    "Förstå enkla regler i spelet",
    "Samarbete och lagkänsla",
  ],
  months: [
    {
      month: "September",
      focus: "Välkommen till basket – lär känna bollen",
      practices: [
        {
          session: 1,
          theme: "Välkommen! Lär känna bollen",
          warmup: "Spring fritt i hallen, när coachen ropar 'stopp' stannar alla. Upprepa med olika rörelser: hoppa, krypa, gå baklänges.",
          drills: [
            "Boll-hälsning: Varje barn får en boll och 'hälsar' på den (rulla den runt kroppen, studsa den, kasta upp och fånga).",
            "Boll-bowling: Rulla bollen mot en kägla/kon. Varje träff = jubel!",
            "Vattenmelonsleken: Håll bollen med båda händerna som en vattenmelon och spring till en markerad plats.",
          ],
          game: "Frilek med bollar – coachen vägleder och uppmuntrar kreativitet.",
          cooldown: "Sätt sig i ring, studsa bollen lugnt en gång var. Prata om vad vi lärde oss idag.",
        },
        {
          session: 2,
          theme: "Studsa och spring",
          warmup: "Studsboll-tag: En person har en boll och studsar den när de jagar. Rör man någon byter de roll.",
          drills: [
            "Stå stilla och studsa bollen med dominant hand 10 gånger.",
            "Gå framåt och studsa bollen samtidigt.",
            "Studslopp: Sprint med studsboll till en kon och tillbaka.",
            "Spegeln: Två barn, en studsar och den andre imiterar.",
          ],
          game: "Hundar och katter: Hälften studsar bollar (hundar), hälften försöker peta bollen ur händerna på dem (katter).",
          cooldown: "Stretcha armarna och benen. Ge grannen en high-five.",
        },
        {
          session: 3,
          theme: "Kasta och fånga",
          warmup: "Löparlek: Spring mellan två linjer, coachen ropar ett nummer och de ska bilda grupper om det antalet.",
          drills: [
            "Par-kast: Kasta bollen till en kompis på 2 meters avstånd.",
            "Chest pass: Coachen visar hur man kastar från bröstet.",
            "Kasta mot väggen och fånga studs.",
            "Kasttävling: Kasta bollen i en korg/låda på marken från 1 meters avstånd.",
          ],
          game: "Passningscirkeln: Stå i ring och passa runt. Se hur snabbt ni kan klara 10 varv!",
          cooldown: "Djupandning – in genom näsan, ut genom munnen. Beröm varandra.",
        },
        {
          session: 4,
          theme: "Min första korgkastning",
          warmup: "Hoppleken: Hoppa fram och tillbaka över en linje 10 gånger, sedan byta till sidhoppar.",
          drills: [
            "Stå precis under korgen och kasta bollen rakt upp i korgen.",
            "Stå 1 meter från korgen och kasta med 'pizza-grepp' (handen under bollen).",
            "Försöka kasta mot tavlan (backboard).",
            "Parövning: En håller bollen, en kastar – byta.",
          ],
          game: "Vem kan göra flest korgar på 2 minuter? (låg korg om möjligt)",
          cooldown: "Linjera upp, varje barn gör en jubel-pose. Ta ett lagfoto!",
        },
      ],
    },
    {
      month: "Oktober",
      focus: "Rörelser och lekar med boll",
      practices: [
        {
          session: 5,
          theme: "Spring med bollen",
          warmup: "Hinken med boll: Alla springer runt, den med 'hinken' (en viss boll) försöker ge den till någon annan.",
          drills: [
            "Studsslalom: Studsa bollen mellan koner/hinder.",
            "Boll-kappkörning i lag.",
            "En-hands studs: Prova att studsa med den andra handen.",
            "Bakåt-studs: Studsa bollen och gå baklänges.",
          ],
          game: "Territorium: Dela upp planen, laget som studsar sin boll längst på motståndarsidan vinner.",
          cooldown: "Raka upp bollen, stretcha kalvar och axlar.",
        },
        {
          session: 6,
          theme: "Lek och rörelse",
          warmup: "Boll-Simon säger: Coachen ger kommandon med bollen (studsa, kasta, håll högt, osv.).",
          drills: [
            "Parlopp: Spring med bollen klammad mellan knäna till kon och tillbaka.",
            "Rullstafett: Rulla bollen längs golvet till lagkamraten.",
            "Boll-balans: Balansera bollen på handen (det gör ingenting om den faller!).",
            "Zigzag studs: Studsa bollen i zigzag-mönster.",
          ],
          game: "Basketboll-tag: Spring med bollen klämd under armen. Taggas man är man fryst tills en lagkamrat löser en.",
          cooldown: "Sträck upp armarna högt, ned till tårna. Klapp för alla!",
        },
        {
          session: 7,
          theme: "Passa till kompisen",
          warmup: "Kaos-pass: Alla rör sig fritt på planen och passar till vem de vill. Ingen ska stå still!",
          drills: [
            "Chest pass i par – fokus på raka armar framåt.",
            "Overhead pass: Kasta från ovan huvudet.",
            "Triangel-pass: Tre barn, passa runt triangeln.",
            "Passa och spring: Passa och följ bollen direkt.",
          ],
          game: "Ketchup: Laget passar bollen, den som passade springer runt ett hinder och ställer sig sist i raden.",
          cooldown: "Sätt sig i par, stretcha ryggen mot varandra.",
        },
        {
          session: 8,
          theme: "Mitt första riktiga spel",
          warmup: "Dynamisk uppvärmning: Löpskola (knälyft, häcklöpning, sidsteg).",
          drills: [
            "Repetition: Studsa, passa och kasta mot korg.",
            "Enkel positionering: Förstå att det finns 'mitt lag' och 'motståndarlaget'.",
            "Öva på att passa till en fri medspelare.",
          ],
          game: "3v3 minibasket med förenklade regler: Inga steg-fel, fritt att ta med sig bollen.",
          cooldown: "Samlingscirkel: Vad var roligast idag? Varje barn svarar.",
        },
      ],
    },
    {
      month: "November",
      focus: "Grundfärdigheter med lek",
      practices: [
        {
          session: 9,
          theme: "Studs-mästare",
          warmup: "Kaninhoppslöpning: Hoppa som en kanin mellan koner, sedan byta till jättelånga steg.",
          drills: [
            "Studsa bollen utan att titta ned (bli kompis med bollen).",
            "Studsa och snurra runt 360 grader.",
            "Studsa och klappa händerna.",
            "Studsa i lågt läge (Crouching Tiger).",
          ],
          game: "Studs-kung: Studsa sin boll och försöka peta andras bollar ut från en avgränsad yta. Sist kvar = studs-kung!",
          cooldown: "Lugn jogg ett varv, sedan stretcha skinkorna.",
        },
        {
          session: 10,
          theme: "Korg-kaos",
          warmup: "Boll-tåget: Alla håller i varandras axlar, ett tåg, och det sista barnet måste kasta bollen till det första.",
          drills: [
            "Varje barn kastar 5 gånger mot korgen från lämpligt avstånd.",
            "Lägga upp bollen: Gå in mot korgen och lägga upp på tavlan.",
            "Tävling: Vilken grupp gör flest korgar på 3 minuter?",
          ],
          game: "Korgtävling i grupper om 3: En kastar, en hämtar returen, en räknar korgar.",
          cooldown: "Klapp för laget. Stretcha nacken och skuldrorna.",
        },
        {
          session: 11,
          theme: "Lagkänsla",
          warmup: "Parlek: Händerna kopplade, spring tillsammans utan att tappa greppet.",
          drills: [
            "2v1 enkel övning: Två anfallare mot en försvarare, öva på att passa förbi.",
            "Passa och röra dig till ett nytt ställe.",
            "Enkelt pick and roll (coachen visar, barnen provar).",
          ],
          game: "4v4 mini-basket med ett mål: Alla i laget måste röra bollen innan man får göra korg.",
          cooldown: "Gör en lagcirkel och räkna ned: 3-2-1 BASKET!",
        },
        {
          session: 12,
          theme: "Repetition och lek",
          warmup: "Fri uppvärmning med bollar – coachen spelar musik, när musiken stannar = frys!",
          drills: [
            "Barnens val: Vilken övning var roligast? Välj 3 favoritövningar.",
            "Studs-mästare-tävling: Vem kan studsa längst utan misstag?",
          ],
          game: "Frilek basket-match: Enkla regler, alla ska få chansen att kasta.",
          cooldown: "Sätt sig i ring. Varje barn berättar en sak de blivit bättre på.",
        },
      ],
    },
    {
      month: "December",
      focus: "Juluppehåll & korta pass",
      practices: [
        {
          session: 13,
          theme: "Julbasket och lek",
          warmup: "Tomte-löp: Spring runt koner förklädda som tomtar (röda mössor om möjligt).",
          drills: [
            "Snöbolls-pass: Passa bollen (snöbollen) till kompisar.",
            "Julgranen: Stapla bollar som en julgran (kräver extra bollar och fantasin!).",
            "Kasta korgen: Varje korg = en julklapp i fantasin.",
          ],
          game: "Jul-basket: Fritt spel med julmusik i bakgrunden.",
          cooldown: "God jul! Varje barn höjer bollen och ropar 'GOD JUL!'",
        },
        {
          session: 14,
          theme: "Avslutning och fika",
          warmup: "Favoritövningar från hela hösten.",
          drills: [
            "Mini-turnering 2v2.",
            "Roligaste drillen barnen väljer.",
          ],
          game: "Mästerskap-avslutning: Alla vinner en medalj/klistermärke!",
          cooldown: "Fika och samtal om säsongen. Alla berättar om sin bästa stund.",
        },
      ],
    },
    {
      month: "Januari",
      focus: "Ny start – repetera och bygg vidare",
      practices: [
        {
          session: 15,
          theme: "Välkommen tillbaka",
          warmup: "Vem minns? Coachen ger kommandon: studsa, passa, kasta – se vad barnen minns från hösten.",
          drills: [
            "Repetition av studs: Stå stilla och gå.",
            "Repetition av chest pass i par.",
            "Repetition av korg-kast nära korgen.",
          ],
          game: "3v3 välkomstmatch – fokus på glädje inte regler.",
          cooldown: "Välkommen tillbaka-kramen: Alla kramar en ny kompis.",
        },
        {
          session: 16,
          theme: "Snabba fötter",
          warmup: "Stegskola: Löpsteg, sidsteg, backpedal och stoppstopp.",
          drills: [
            "Stepladdder (hoppa i stegmönster om ingen stege: tejpa på golvet).",
            "Snabbt byte: Coachen ropar en riktning, barnen springer dit.",
            "Försvarsposition: Bred stance, knäna böjda – låg och stabil.",
          ],
          game: "Spegel-tag: En försöker spegla motståndarens rörelser, försök ta bollen.",
          cooldown: "Stretcha quadriceps och hamstrings.",
        },
      ],
    },
    {
      month: "Februari",
      focus: "Spelet börjar ta form",
      practices: [
        {
          session: 17,
          theme: "Enkel försvarsstance",
          warmup: "Krabblöpning: Gå på alla fyra (bara händer och fötter) längs hallen.",
          drills: [
            "Försvarsslide: Sidsteg i försvarsposition utan att korsa benen.",
            "Skugga anfallaren: En offensiv, en defensiv – defensiven följer med.",
            "Försvarshänder: Aktiva händer utan att trycka.",
          ],
          game: "1v1 enkel: Anfallaren studsar mot korgen, försvararen försöker störa.",
          cooldown: "Bra jobbat! Stretcha sidorna.",
        },
        {
          session: 18,
          theme: "Passa och röra sig",
          warmup: "Kaos-löpning med passningar: Rör sig fritt och passa till vem du möter.",
          drills: [
            "Pass och kliv: Passa, ta ett kliv mot mottagaren.",
            "3-mans weave (enkel version): Tre i rad, passa och spring.",
            "Passa till en som springer.",
          ],
          game: "2v2 med fokus: Man måste passa minst en gång innan kast.",
          cooldown: "Lugnt varv runt planen. Klapp för alla.",
        },
        {
          session: 19,
          theme: "Läggning mot korgen",
          warmup: "Hoppstuds: Studsa och hoppa i luften utan boll, landa mjukt.",
          drills: [
            "Läggningsrörelse utan boll: Höger fot – höger knä upp – höger hand.",
            "Läggning med boll från stillastående precis vid korgen.",
            "Gå in och lägg upp (inga steg-regler för år 1).",
          ],
          game: "Läggningsrace: Vem gör flest läggningar på 3 minuter?",
          cooldown: "Stretcha vrister och knän.",
        },
        {
          session: 20,
          theme: "Spela match",
          warmup: "Dynamisk uppvärmning: Jogg, snabba steg, sprinter.",
          drills: [
            "Snabb repetition av veckans rörelser.",
            "Diskutera: Vad är en bra lagkamrat?",
          ],
          game: "3v3 match med enkla regler – coachen coachar positivt från sidan.",
          cooldown: "Spelarna ger varandra komplimanger. Avslutande samling.",
        },
      ],
    },
    {
      month: "Mars",
      focus: "Matchspel och roligt avslut",
      practices: [
        {
          session: 21,
          theme: "Vi spelar match!",
          warmup: "Lagbyggande lek: Blanda lagen, ny kompis att leka med.",
          drills: [
            "Repetition av alla grundfärdigheter – studs, pass, kast.",
            "Snabb Q&A: Vad gör man när man inte har bollen?",
          ],
          game: "4v4 match med enkla regler. Alla spelar lika länge.",
          cooldown: "High-fives med motståndarlaget.",
        },
        {
          session: 22,
          theme: "Säsongsfinal",
          warmup: "Favorituppvärmning röstad av barnen.",
          drills: [
            "Favoritövningarna från hela säsongen.",
            "Foto-station: Pose med boll som ett riktigt proffs!",
          ],
          game: "Säsongsavslutning – mini-turnering eller frilek.",
          cooldown: "Diplomutdelning/klistermärken. Klapp för en fantastisk säsong!",
        },
      ],
    },
  ],
};
