import type { SeasonPlan } from "./types";

export const ishockeyYear1Plan: SeasonPlan = {
  year: 1,
  ageGroup: `Upp till 7 år`,
  description: `Första säsongen fokuserar på skridskoglädje och grundläggande skridskoåkning. Träningarna är 50–60 min med lekfulla övningar på isen.`,
  coachTips: [
    `Säkerhet först – kontrollera att all utrustning sitter rätt.`,
    `Håll barnen rörliga hela passet – ingen ska stå still länge.`,
    `Positiv och uppmuntrande ton – det är svårt att åka skridskor!`,
    `Lekfulla övningar gör att barnen inte märker att de lär sig.`,
    `Korta pauser med vatten – is är krävande.`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Skridskostart`,
      activities: [
        {
          name: `Fritt åkande`,
          description: `Barnen åker fritt på isen i 5 minuter och vänjer sig vid känslan. Tränaren uppmuntrar och hjälper dem som faller.`,
          tips: `Tips! Visa hur man reser sig från isen på ett bra sätt.`,
        },
        {
          name: `Knäböj och balanssteg`,
          description: `Barnen övar på att böja knäna ordentligt när de åker. Tränaren visar hur djupa knäböj ger bättre balans.`,
          tips: `Tips! "Böj som om du sitter på en stol!"`,
        },
        {
          name: `Bromsövning`,
          description: `Varje barn åker mot en linje och ska bromsa precis på linjen. Använd T-bromsen (snowplow) som första inbromsning.`,
        },
        {
          name: `Lekfri åkning`,
          description: `Barnen åker runt isen och försöker hinna ifatt varandra (ett enkelt kull-spel på is).`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Puckkontroll`,
      activities: [
        {
          name: `Puckbekantskap`,
          description: `Varje barn får en puck. De rör pucken med klubban framåt, bakåt och åt sidorna – stående still.`,
          tips: `Tips! "Håll pucken nära kroppen och känn tyngden."`,
        },
        {
          name: `Åk och hantera pucken`,
          description: `Barnen åker lugnt och knuffar pucken framför sig. Fokus på att hålla pucken i rörelse.`,
        },
        {
          name: `Slalombana med puck`,
          description: `Enkla koner i slalom. Barnen åker igenom och tar med sig pucken.`,
        },
        {
          name: `Skott mot mål`,
          description: `Barnen ställer sig 3–4 meter från mål och skjuter på mål (utan keeper). Fokus på att träffa, inte på styrka.`,
          tips: `Tips! Visa hur man riktar pucken med bladet.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Passningar`,
      activities: [
        {
          name: `Parpassningar stående`,
          description: `I par, passa pucken till varandra på 3 meters håll. Fokus på att passera längs isen (inte lyft pucken).`,
        },
        {
          name: `Åkande passningar`,
          description: `Samma som ovan men båda åker långsamt och passar till varandra i rörelse.`,
          tips: `Tips! "Passa mot var kompisen ska vara, inte var hen är!"`,
        },
        {
          name: `3v3 match`,
          description: `Liten match 3v3 på halvan av isen. Inga komplicerade regler – bara spela och ha kul.`,
        },
      ],
    },
  ],
};

export const ishockeyYear2Plan: SeasonPlan = {
  year: 2,
  ageGroup: `8 år`,
  description: `Andra säsongen bygger vidare på skridskoåkning och introducerar matchspelet mer systematiskt. 36 träningspass à 60 min.`,
  coachTips: [
    `Introducera positionerna – anfallare och försvarare.`,
    `Öva på att åka bakåt – viktigt för back-positionen.`,
    `Uppmuntra att göra rätt saker, inte bara göra mål.`,
    `Korta taktiksamtal vid tavlan kan introduceras.`,
    `Ha roliga tävlingsmoment i varje träning.`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Bakåtåkning`,
      activities: [
        {
          name: `Bakåtåkningsövning`,
          description: `Barnen lär sig C-cut bakåt. De pushar med vänster fot, sedan höger, och åker bakåt längs sargen.`,
          tips: `Tips! "Tänk att du ritar ett C på isen med varje fot."`,
        },
        {
          name: `Bakåt i match`,
          description: `Backarna övar på att åka bakåt medan anfallarna attackerar. Fokus på att hålla rätt avstånd.`,
        },
        {
          name: `Övningsspel`,
          description: `Spel med betoning på att backarna försöker åka bakåt vid försvar.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Avslut och skott`,
      activities: [
        {
          name: `Wristshot`,
          description: `Barnen övar på wristshot (handledsskott) mot mål. Fokus på teknik – vikta kroppsvikten och följa igenom.`,
          tips: `Tips! "Skjut från handleden, inte med hela kroppen."`,
        },
        {
          name: `Slap shot intro`,
          description: `En enkel introduktion till slapshot. Barnen tränar svingen utan att slå för hårt.`,
        },
        {
          name: `Skottstafett`,
          description: `Stafett där varje barn skjuter mot mål och springer (åker) tillbaka. Laget med flest mål vinner.`,
        },
        {
          name: `Match`,
          description: `Fri match.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Lagtaktik`,
      activities: [
        {
          name: `2v1 övning`,
          description: `Två anfallare mot en försvarare. Anfallarna försöker passa och skjuta, försvararen försöker blockera.`,
        },
        {
          name: `Powerplay intro`,
          description: `Enkel intro till spel i numerärt överläge (powerplay). 4v3 på halva isen.`,
          tips: `Tips! Förklara varför man håller pucken i rörelse i powerplay.`,
        },
        {
          name: `Match`,
          description: `Full match.`,
        },
      ],
    },
  ],
};

export const ishockeyYear3Plan: SeasonPlan = {
  year: 3,
  ageGroup: `9 år`,
  description: `Tredje säsongen fokuserar på taktik, matchläsning och avancerade tekniska element. 36 träningspass à 60 min.`,
  coachTips: [
    `Börja diskutera systemen (1-2-2, 2-1-2 formationer).`,
    `Ge spelarna roller och ansvar i spelet.`,
    `Videoanalys (kort klipp) kan introduceras.`,
    `Konkurrens i träningen ökar fokus.`,
    `Belöna lagspel och offervilja.`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – System och formationer`,
      activities: [
        {
          name: `Taktikgenomgång`,
          description: `Vid tavlan – förklara 1-2-2 systemet. Visa hur varje spelare rör sig vid anfall respektive försvar.`,
        },
        {
          name: `Formationsövning`,
          description: `5v5 med betoning på att hålla formationen. Tränaren påminner om positionen under spelet.`,
        },
        {
          name: `Match med formationsfokus`,
          description: `Match där coachen utvärderar om laget håller sin formation.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Avancerat avslut`,
      activities: [
        {
          name: `Deflektioner`,
          description: `En spelare vid pucken skjuter, en annan försöker deflektera pucken vid målet.`,
          tips: `Tips! Stå i målets framkant och håll klubban låg.`,
        },
        {
          name: `Skott i rörelse`,
          description: `Barnen tar emot en pass och skjuter direkt i rörelse (one-timer).`,
        },
        {
          name: `Scrimmage`,
          description: `Fri match med fokus på avslut och positionering.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Matchsimulering`,
      activities: [
        {
          name: `Powerplay vs Penalty kill`,
          description: `5v4 spel med betoning på både powerplay och boxplay.`,
        },
        {
          name: `Matchspel`,
          description: `Full match med betoning på att använda vad vi tränat under säsongen.`,
        },
      ],
    },
  ],
};
