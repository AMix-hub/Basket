import type { SeasonPlan } from "./types";

export const innebandyYear1Plan: SeasonPlan = {
  year: 1,
  ageGroup: `Upp till 7 år`,
  description: `Första säsongen introducerar innebandyn på ett lekfullt sätt. Fokus på bollkontroll med klubban och grundläggande rörelseförmåga.`,
  coachTips: [
    `Håll barnen aktiva hela träningen.`,
    `Betona säkerhet med klubban – inga höga slag.`,
    `Positiv och rolig atmosfär är viktigast.`,
    `Korta instruktioner och mycket spelande.`,
    `Ge alla barn lika mycket uppmärksamhet.`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Klubba och boll`,
      activities: [
        {
          name: `Bollbekantskap`,
          description: `Varje barn får en boll och en klubba. De rör bollen fritt i rummet – tryck framåt, bakåt, vrid.`,
          tips: `Tips! Visa hur man håller klubban rätt – vänster hand överst, höger hand under.`,
        },
        {
          name: `Dribblingsbana`,
          description: `Enkla koner i linje. Barnen dribblar igenom banan med fokus på att ha bollen nära klubban.`,
        },
        {
          name: `Skottövning`,
          description: `Barnen ställer sig framför mål och skjuter. Tränaren matar bollen. Alternera hårt och mjukt skott.`,
          tips: `Tips! Mjukt grepp om klubban ger bättre kontroll.`,
        },
        {
          name: `Liten match`,
          description: `3v3 match med enkla regler – ingen offside, ingen hands, bara spela.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Passningar`,
      activities: [
        {
          name: `Parpassningar`,
          description: `I par, 4–5 meters avstånd. Passa till varandra. Fokus på att bollen rullar längs golvet.`,
        },
        {
          name: `Rörlig passning`,
          description: `A springer, B passar bollen framför A som tar emot i rörelse.`,
          tips: `Tips! "Passa dit kompisen ska springa, inte dit hen är!"`,
        },
        {
          name: `Match med passningsregel`,
          description: `Laget måste göra en passning innan de skjuter.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – 1v1 och rörlighet`,
      activities: [
        {
          name: `1v1 övning`,
          description: `Anfallare mot försvarare på litet plan. Anfallaren försöker ta sig förbi och skjuta på mål.`,
          tips: `Tips! Uppmuntra finter och rörelsebyte.`,
        },
        {
          name: `Rörlighetsövning`,
          description: `Barnen övar på att svänga, vända och accellera – utan boll och sedan med boll.`,
        },
        {
          name: `Avslutande match`,
          description: `Fri match med allt vi tränat.`,
        },
      ],
    },
  ],
};

export const innebandyYear2Plan: SeasonPlan = {
  year: 2,
  ageGroup: `8 år`,
  description: `Andra säsongen bygger vidare på teknik och introducerar mer lagtaktik. 36 träningspass à 60 min.`,
  coachTips: [
    `Introducera enkla positioner – centern, vänster/höger och back.`,
    `Uppmuntra snabbt passningsspel.`,
    `Beläggning av keeper – rotera keeper ofta.`,
    `Öva på att vara i rätt position.`,
    `Variation håller motivationen uppe.`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Passningsspel`,
      activities: [
        {
          name: `Triangelpassning`,
          description: `Grupper om tre. Passa runt triangeln, sedan ändra riktning.`,
        },
        {
          name: `Ge och gå`,
          description: `Passa till kompisen, spring förbi och ta emot returen.`,
          tips: `Tips! "Passa och sprint – aldrig stå still!"`,
        },
        {
          name: `Match med passningsregel`,
          description: `3 passningar krävs innan avslut. Dubbla poäng om regeln följs.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Positionsspel`,
      activities: [
        {
          name: `Positionsgenomgång`,
          description: `Tränaren förklarar de fem positionerna (2 forwards, 1 center, 2 backs). Barnen provar varje position.`,
        },
        {
          name: `Matchspel med positioner`,
          description: `5v5 med tydliga positioner. Tränaren coachar under spelet.`,
        },
        {
          name: `Fri match`,
          description: `Fri match.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Avslut och keeper`,
      activities: [
        {
          name: `Avslutsövning`,
          description: `Varje barn skjuter på mål från olika vinklar. Keeper roterar varje 2–3 skott.`,
          tips: `Tips! Uppmuntra att skjuta mot de sämre skyddade hörnen.`,
        },
        {
          name: `2v1`,
          description: `Två anfallare mot en försvarare och keeper.`,
        },
        {
          name: `Match`,
          description: `Full match.`,
        },
      ],
    },
  ],
};

export const innebandyYear3Plan: SeasonPlan = {
  year: 3,
  ageGroup: `9 år`,
  description: `Tredje säsongen fokuserar på taktik, lagsystem och avancerade tekniska moment. 36 träningspass à 60 min.`,
  coachTips: [
    `Diskutera taktik med spelarna – de ska förstå varför.`,
    `Introducera powerplay och boxplay.`,
    `Analysera matcher och ge konstruktiv feedback.`,
    `Ge spelarna ansvar och självförtroende.`,
    `Ha kul – det är fortfarande idrott!`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Lagsystem`,
      activities: [
        {
          name: `Systemgenomgång`,
          description: `Vid tavlan – förklara anfalls- och försvarsystemet. Hur rör sig laget som en enhet?`,
        },
        {
          name: `Systemövning`,
          description: `5v5 med fokus på att hålla systemet. Tränaren stoppar spelet och korrigerar.`,
        },
        {
          name: `Matchspel`,
          description: `Match med systemfokus.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Powerplay och boxplay`,
      activities: [
        {
          name: `Powerplay`,
          description: `4v3 spel. Laget med fler spelare tränar på att cirkulera bollen och skapa chanser.`,
          tips: `Tips! "Håll bollen i rörelse – skjut inte förrän du har ett bra läge."`,
        },
        {
          name: `Boxplay`,
          description: `Det underlägsna laget tränar på att skydda mittzon och tvinga motståndarna till yttre skott.`,
        },
        {
          name: `Match`,
          description: `Full match.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Säsongsavslutning`,
      activities: [
        {
          name: `Teknikgenomgång`,
          description: `Varje spelare väljer en teknik att arbeta på under 15 minuter.`,
        },
        {
          name: `Avslutande match`,
          description: `Säsongens sista match. Fokus på glädje och lagkänsla.`,
        },
      ],
    },
  ],
};
