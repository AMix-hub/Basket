import type { SeasonPlan } from "./types";

export const fotbollYear1Plan: SeasonPlan = {
  year: 1,
  ageGroup: `Upp till 7 år`,
  description: `Första säsongen fokuserar på glädje, lek och grundläggande rörelseglädje. Träningarna är 50–60 min och introducerar fotbollens grundelement på ett lekfullt sätt.`,
  coachTips: [
    `Håll barnen aktiva hela träningen – stå aldrig still i kö.`,
    `Använd bollen i varje övning – repetition ger färdighet.`,
    `Ha kul och skratta tillsammans – positiv energi smittar.`,
    `Berömma försök och ansträngning, inte bara resultat.`,
    `Korta förklaringar – visa istället för att prata länge.`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Bollbekantskap`,
      activities: [
        {
          name: `Hitta din boll`,
          description: `Varje barn får en boll. De springer fritt i rummet och utforskar bollen – rulla med foten, stoppa, dribbla lätt. Tränaren ropar ut utmaningar: "Håll bollen still!", "Spring med bollen till väggen!", "Ta bollen under foten!"`,
          tips: `Tips! Låt barnen utforska fritt i 2–3 minuter innan du ger uppgifter. Det bygger bollkänsla naturligt.`,
        },
        {
          name: `Dribblingsstafett`,
          description: `Dela in barnen i par. De turas om att dribbla bollen till en kon och tillbaka, sedan lämnar de bollen till kompisen. Prova med höger fot, vänster fot och båda fötterna.`,
          tips: `Tips! Uppmuntra dem att titta upp och inte bara titta på bollen.`,
        },
        {
          name: `Skottövning mot mål`,
          description: `Varje barn ställer sig 3–5 meter från ett mål. De skjuter med höger fot, hämtar bollen och skjuter sedan med vänster fot. Fokus på att träffa målet, inte kraften.`,
          tips: `Tips! Visa hur man ställer stödfoten vid sidan av bollen. Enkelt och tydligt.`,
        },
        {
          name: `Liten match`,
          description: `3v3 eller 4v4 på litet plan med mål. Inga regler om hands och offsides – bara spela och ha kul. Byt lag varannan minut.`,
          tips: `Tips! Håll matcher korta och byt ofta så alla är aktiva hela tiden.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Passningar och rörelse`,
      activities: [
        {
          name: `Parpassningar`,
          description: `Barn i par med en boll. De passar till varandra på 3–4 meters håll. Fokus på att passa med insidan av foten och ta emot med sulan.`,
          tips: `Tips! Visa hur insidan av foten ser ut och hur man "blockar" bollen med sulan.`,
        },
        {
          name: `Rörlig passning`,
          description: `En i paret springer och den andre passar bollen i rörelse. Mottagaren stoppar bollen, springer tillbaka och passar tillbaka.`,
          tips: `Tips! Börja långsamt och öka tempot successivt.`,
        },
        {
          name: `Bollkontroll – stoppa och vrid`,
          description: `Tränaren kastar bollen till varje barn. De ska ta emot med bröstet eller benet, stoppa bollen på marken och dribbla till en kon.`,
        },
        {
          name: `Avslutande match`,
          description: `4v4 med fokus på att försöka passa till en kompis minst en gång innan man skjuter.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Vändningar och 1v1`,
      activities: [
        {
          name: `Vändningsövning`,
          description: `Barnen dribblar framåt till en kon, gör en vändning (med insidan eller utsidan av foten) och dribblar tillbaka.`,
          tips: `Tips! Lär ut "instegsvänd" – en enkel rörelse att komma ihåg.`,
        },
        {
          name: `1v1 till linje`,
          description: `I par, en anfallare och en försvarare. Anfallaren försöker dribbla förbi försvararen och nå linjen. Byt roller.`,
          tips: `Tips! Uppmuntra anfallaren att bluffa med kroppen.`,
        },
        {
          name: `Avslutande match`,
          description: `Fri match med fokus på att dribbla och ta med sig bollen.`,
        },
      ],
    },
  ],
};

export const fotbollYear2Plan: SeasonPlan = {
  year: 2,
  ageGroup: `8 år`,
  description: `Andra säsongen bygger vidare på grunderna och introducerar lagtaktik. 36 träningspass à 60 min med mer fokus på passningsspel och positionering.`,
  coachTips: [
    `Introducera enkla positioner – anfallare, mittfältare, försvarare.`,
    `Uppmuntra snabb passning – "spela enkelt, spela snabbt".`,
    `Låt barnen ta egna beslut på planen – tänk inte för dem.`,
    `Variation i övningarna håller engagemanget uppe.`,
    `Inled alltid med en rolig uppvärming.`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Passningsspelet`,
      activities: [
        {
          name: `Passningstrianglar`,
          description: `Grupper om tre. De bildar en triangel och passar bollen runt, sedan i omvänd riktning. Successivt öka tempot.`,
          tips: `Tips! "Flytta fötterna – ta emot i rörelse, passa i rörelse."`,
        },
        {
          name: `Ge-och-gå`,
          description: `A passar till B och springer förbi. B passar tillbaka till A som är i rörelse. Öva att alltid röra sig efter passet.`,
          tips: `Tips! "Passa och spring alltid!" – bra grundregel.`,
        },
        {
          name: `Passningsbana`,
          description: `Konbana med passningar vid varje kon. Paren navigerar banan och fokuserar på precision.`,
        },
        {
          name: `Match med passningsregel`,
          description: `5v5 match. Laget måste göra minst 3 passningar innan de skjuter. Poäng räknas dubbelt om de lyckas.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Positionsspel`,
      activities: [
        {
          name: `Positionsövning`,
          description: `Tränaren förklarar de tre grundläggande positionerna. Barnen placerar sig på sin position och spelar en match med enkel positionsstruktur.`,
        },
        {
          name: `Omställning`,
          description: `Laget övar på att snabbt ställa om från försvar till anfall och tvärtom. Tränaren blåser i visselpipan och laget byter riktning.`,
          tips: `Tips! "Snabb omställning är det viktigaste i modern fotboll!"`,
        },
        {
          name: `Spel 7v7`,
          description: `Fullständig match på halvplan med alla positioner bemannade.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Avslut och teknik`,
      activities: [
        {
          name: `Avslutsövning`,
          description: `Barnen övar på att skjuta i rörelse. De springer mot bollen och skjuter mot mål med keeper.`,
          tips: `Tips! Öva på att sikta mot hörnen, inte mitten av målet.`,
        },
        {
          name: `Combination play`,
          description: `3 mot 1 i en ruta – de tre passar bollen och försöker hålla undan från den ene.`,
        },
        {
          name: `Avslutande match`,
          description: `Fri match med fokus på det vi tränat.`,
        },
      ],
    },
  ],
};

export const fotbollYear3Plan: SeasonPlan = {
  year: 3,
  ageGroup: `9 år`,
  description: `Tredje säsongen introducerar taktik och mer avancerade tekniska element. Fokus på matchförståelse och lagarbete.`,
  coachTips: [
    `Diskutera taktik med spelarna – fråga vad de tyckte fungerade.`,
    `Börja introducera set pieces (hörnsparkar, frisparkar).`,
    `Analysera matcher kort efteråt – vad gick bra, vad kan förbättras?`,
    `Ge spelarna eget ansvar och uppmuntra initiativ.`,
    `Ha alltid roliga inslag – fotboll ska vara kul!`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Presspel`,
      activities: [
        {
          name: `Presspel i fyrkant`,
          description: `4v2 i en fyrkant. De fyra yttre spelar ihop och de två inre försöker erövra bollen. Byt de inre var 90:e sekund.`,
          tips: `Tips! "Press tillsammans – inte ensam!"`,
        },
        {
          name: `Presstrigger`,
          description: `Tränaren förklarar presstriggers – när ska laget pressa? (backpass, dålig touch). Öva med halvplansspel.`,
        },
        {
          name: `Match med pressregel`,
          description: `5v5. Om laget vinner bollen i motståndarens planhalva och gör mål, räknas det dubbelt.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Taktik och speluppfattning`,
      activities: [
        {
          name: `Speluppfattningsövning`,
          description: `11v11 (eller tillgängliga spelare) på stor plan. Tränaren stoppar spelet och frågar: "Vart ska vi passa? Vem är fri?" Spelarna svarar och resonerar.`,
        },
        {
          name: `Set pieces`,
          description: `Öva på hörnsparkar och frisparkar. Varje spelare roterar och tar set piecen.`,
          tips: `Tips! Enkla inövade rörelsemönster som spelarna kan utföra under match.`,
        },
        {
          name: `Match`,
          description: `Fri match med fokus på att använda inövad taktik.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Avslutning och genomgång`,
      activities: [
        {
          name: `Teknisk finslipning`,
          description: `Fokus på individuell teknik: vändningar, finter, avslut. Varje barn väljer ett moment att öva på.`,
        },
        {
          name: `Lagmatch med diskussion`,
          description: `Match följt av en kortare gemensam diskussion. Vad gick bra? Vad kan vi förbättra?`,
        },
      ],
    },
  ],
};
