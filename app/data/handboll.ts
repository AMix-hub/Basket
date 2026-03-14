import type { SeasonPlan } from "./types";

export const handbollYear1Plan: SeasonPlan = {
  year: 1,
  ageGroup: `Upp till 7 år`,
  description: `Första säsongen fokuserar på kastglädje, bollkänsla och rörelseglädje. Vi leker med bollen och lär oss grunderna i handboll på ett lekfullt sätt.`,
  coachTips: [
    `Håll övningarna korta och roliga – max 5–7 minuter per moment.`,
    `Betona glädje och deltagande, inte teknisk perfektion.`,
    `Använd mjukare bollar anpassade för barns händer.`,
    `Ge positiv feedback vid varje försök.`,
    `Avsluta alltid med ett litet spel så alla får "matchtid".`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Välkommen till handboll`,
      activities: [
        {
          name: `Bollbekantskap`,
          description: `Varje barn får en boll. De kastar upp och fångar, studsar mot marken, rullar på golvet. Utforska bollen fritt.`,
          tips: `Tips! "Håll bollen med fingertopparna, inte hela handen."`,
        },
        {
          name: `Kastcirkel`,
          description: `Stå i en ring och kasta bollen till varandra. Börja kort avstånd (2 m) och öka successivt.`,
        },
        {
          name: `Minimatch`,
          description: `Enkelt spel 2v2 på litet mål. Inga komplicerade regler – bara kasta och försöka göra mål.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Kasta och fånga`,
      activities: [
        {
          name: `Overhandskast`,
          description: `Tränaren visar overhandskastet: lyft armbågen, sträck och kasta. Barnen övar mot vägg eller målvakt.`,
          tips: `Tips! "Armbåge upp – som en pil!"`,
        },
        {
          name: `Fångstövning`,
          description: `Para ihop barnen. Kasta till varandra och försök fånga med båda händerna. Öka avståndet när de lyckas.`,
        },
        {
          name: `Minimatch`,
          description: `3v3 på liten plan. Tränaren uppmuntrar kastförsök mot mål.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Rörelse och passningar`,
      activities: [
        {
          name: `Rörelseövning`,
          description: `Spring, hoppa, vänd – barnen rör sig fritt på planen och tränaren ropar kommandon.`,
        },
        {
          name: `Rörlig passning`,
          description: `Barnen går i par längs planen och passar bollen till varandra medan de rör sig framåt.`,
          tips: `Tips! "Passa och spring vidare – håll rörelsen igång!"`,
        },
        {
          name: `Minimatch`,
          description: `Avslutande 2v2 eller 3v3. Fokus på att alla får kasta.`,
        },
      ],
    },
  ],
};

export const handbollYear2Plan: SeasonPlan = {
  year: 2,
  ageGroup: `8 år`,
  description: `Andra säsongen introducerar grundläggande lagspel, positionering och skotteknik. 36 träningspass à 60 min med fokus på samarbete och bollhantering.`,
  coachTips: [
    `Introducera enkla spelregler steg för steg.`,
    `Betona passningsspel – bygg upp laganda.`,
    `Öva dribbling med dominant hand.`,
    `Introducera enkel uppställning (3–2–1 eller fri placering).`,
    `Håll matcherna korta och ge alla lika speltid.`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Passningsspel`,
      activities: [
        {
          name: `Triangelpassning`,
          description: `3 spelare i triangel passar bollen snabbt runt. Fokus på korta, säkra passningar.`,
          tips: `Tips! "Ta emot – titta – passa. Håll flödet uppe!"`,
        },
        {
          name: `Passning i rörelse`,
          description: `Passpel längs planen. Spela bollen framåt och spring till ny position.`,
        },
        {
          name: `3v3 med passningskrav`,
          description: `Laget måste göra minst 3 passningar innan de får skjuta.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Skotteknik`,
      activities: [
        {
          name: `Skottövning mot mål`,
          description: `Barnen ställer sig på 6 m och skjuter på mål, en i taget. Fokus på overhandskast och träffsäkerhet.`,
          tips: `Tips! "Sikta på hörnen – svårt för målvakten att nå!"`,
        },
        {
          name: `Rörelse + skott`,
          description: `Spring mot mål, ta emot pass och skjut. Simulerar verklig matchsituation.`,
        },
        {
          name: `Matchspel`,
          description: `4v4 match på halv plan. Tränaren fokuserar coachning på skottmöjligheter.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Försvarsspel`,
      activities: [
        {
          name: `1v1-försvar`,
          description: `Angripare försöker ta sig förbi försvararen. Försvararen ska hålla sin position utan att falla för finter.`,
          tips: `Tips! "Böjda knän, aktiva armar – var beredd på båda håll!"`,
        },
        {
          name: `Zonförsvar intro`,
          description: `Tränaren förklarar grundläggande 6-0 (rak linje) och visar hur spelarna täcker sina zoner.`,
        },
        {
          name: `Match med försvarsfokus`,
          description: `4v4 – coachen coachar försvaret och uppmuntrar kommunikation i försvarslinjen.`,
        },
      ],
    },
  ],
};

export const handbollYear3Plan: SeasonPlan = {
  year: 3,
  ageGroup: `9 år`,
  description: `Tredje säsongen fokuserar på taktik, rollfördelning och turneringsspel. Spelet sker på anpassad plan med full speluppfattning i fokus.`,
  coachTips: [
    `Introducera enkla anfallsmönster (ge-och-gå, korsning).`,
    `Jobba med målvaktscoachning – positionering och reaktion.`,
    `Låt spelarna förstå roller: kantspelare, mittnia, pivot.`,
    `Uppmuntra turneringsdeltagande för matcherfarenhet.`,
    `Analysera matcher med spelarna – vad fungerade?`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Anfallsmönster`,
      activities: [
        {
          name: `Ge-och-gå`,
          description: `Spelare A passar till B och springer in bakom B som lämnar tillbaka. A skjuter. Öva på båda sidorna.`,
          tips: `Tips! "Passa och spring – rörelse skapar frirum!"`,
        },
        {
          name: `Korsning`,
          description: `Två mittspelare korsar varandra. Den utan boll kan ta emot pass och skjuta direkt.`,
        },
        {
          name: `5v5 med anfallsmönster`,
          description: `Matchen spelas med krav på att använda minst ett inövat anfallsmönster per attack.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Rollspel`,
      activities: [
        {
          name: `Kantspelare`,
          description: `Kanterna övar på att ta emot pass i full fart och skjuta från svår vinkel. Fokus på kroppskontroll.`,
        },
        {
          name: `Pivot/cirkelspel`,
          description: `Pivoten övar på att ta emot och vända snabbt för skott eller fint. Grundläggande pivotteknik.`,
          tips: `Tips! "Skärm och vänd – skapar obalans i försvaret!"`,
        },
        {
          name: `Matchspel med rollfördelning`,
          description: `5v5 där varje spelare har sin utsedda roll. Tränaren roterar positionerna under matchen.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Turneringsspel`,
      activities: [
        {
          name: `Turneringssimulering`,
          description: `Intern turnering i round-robin-format. Lagen roteras och alla spelar mot alla.`,
        },
        {
          name: `Genomgång`,
          description: `Gemensam genomgång efter turneringen – vad fungerade bra, vad övar vi mer på nästa säsong?`,
        },
      ],
    },
  ],
};
