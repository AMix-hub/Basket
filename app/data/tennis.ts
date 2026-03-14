import type { SeasonPlan } from "./types";

export const tennisYear1Plan: SeasonPlan = {
  year: 1,
  ageGroup: `Upp till 7 år`,
  description: `Första säsongen fokuserar på koordination, bollkänsla och glädje med racket. Vi använder mini-tennis med mjukare bollar och kortare banor.`,
  coachTips: [
    `Använd mini-tennis-format (kortare bana, mjukare boll).`,
    `Betona koordination och rörelse, inte teknisk perfektion.`,
    `Gör det lekfullt – tennishjältar och roliga berättelser.`,
    `Kort instruktion, mycket spel.`,
    `Uppmuntra alla försök – det är svårt att slå bollen!`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Racket och boll`,
      activities: [
        {
          name: `Balansövning med racket`,
          description: `Barnen balanserar bollen på racketet och försöker gå runt planen utan att tappa.`,
          tips: `Tips! Börja stillastående och öka svårigheten successivt.`,
        },
        {
          name: `Studsboll`,
          description: `Studsa bollen uppåt med racketet, se hur många gånger i rad du klarar. Sedan byta till att studsa mot marken.`,
        },
        {
          name: `Kasthit`,
          description: `Tränaren kastar bollen till barnet som slår tillbaka med en forehand. Fokus på att träffa bollen.`,
          tips: `Tips! "Korsande arm – svinga och följ igenom."`,
        },
        {
          name: `Minipong`,
          description: `Barnen spelar mot varandra på korta banor (2×4 m). Inga pinaltyregler – bara boll i bana.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Forehand`,
      activities: [
        {
          name: `Forehandteknik`,
          description: `Tränaren visar forehandstaget steg för steg: grepp, steg mot bollen, sving, genomsvingning.`,
          tips: `Tips! "Tänk att du skakar hand med racketet – Continental grip."`,
        },
        {
          name: `Droppmataövning`,
          description: `Tränaren droppar bollen framför barnet som slår forehand. Fokus på timing.`,
        },
        {
          name: `Rall`,
          description: `Par försöker ralla (växla slag) så länge som möjligt. Räkna antalet slag.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Backhand intro`,
      activities: [
        {
          name: `Backhandteknik`,
          description: `Enkel introduktion till backhand (tvåhands-backhand rekommenderas för nybörjare). Tränaren visar greppet.`,
        },
        {
          name: `Forehand/backhand alternering`,
          description: `Tränaren matar bollen, omväxlande till forehand-sidan och backhand-sidan.`,
        },
        {
          name: `Mini-match`,
          description: `Korta matcher på halvbana. Enkel poängräkning.`,
        },
      ],
    },
  ],
};

export const tennisYear2Plan: SeasonPlan = {
  year: 2,
  ageGroup: `8 år`,
  description: `Andra säsongen bygger vidare på grundslagen och introducerar serven. 36 träningspass à 60 min på röd bana (2/3-storlek).`,
  coachTips: [
    `Introducera serven – enkel rörelseteknik utan full kraft.`,
    `Öva konsekvent rall – bygger tålamod och precision.`,
    `Variera övningar: individuellt, par, litet lag.`,
    `Introducera enkel poängräkning och regler.`,
    `Uppmuntra sportsmannaskap – beröm motståndaren.`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Servintroduktion`,
      activities: [
        {
          name: `Kastserv`,
          description: `Barnen lär sig kastnivån (toss). Öva att kasta bollen rakt upp och fånga den utan att slå.`,
          tips: `Tips! "Kasta på klockan 1 (om du är högerhänt)."`,
        },
        {
          name: `Servrörelserna`,
          description: `I delar: (1) toss + grepp, (2) backswing, (3) sving och träff. Öva varje del separat.`,
        },
        {
          name: `Serva in`,
          description: `Barnen servar in i servicerutan. Räkna hur många av 5 man lyckas med.`,
        },
        {
          name: `Matcha med serve`,
          description: `Spelar matcher men börjar varje poäng med en serve.`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Konsekvent rall`,
      activities: [
        {
          name: `Rallövning`,
          description: `Par rallar på halv bana med målet att nå 10 slag i rad. Räkna och försöka slå rekordet.`,
        },
        {
          name: `Riktat slag`,
          description: `Tränaren matar, barnen skjuter mot en specifik målruta. Bygger precision.`,
          tips: `Tips! "Titta var du vill träffa – sedan slå."`,
        },
        {
          name: `Match`,
          description: `Match på röd bana med poängräkning.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Volley och nät`,
      activities: [
        {
          name: `Volleyintroduktion`,
          description: `Vid nätet – korta block-volleyer. Fokus på stabil racketposition.`,
          tips: `Tips! "Inget sving vid nät – block och styr."`,
        },
        {
          name: `Nät vs baslinje`,
          description: `En vid nätet, en vid baslinjen. Baslinjen slår, nätet volleys. Byt.`,
        },
        {
          name: `Match med nätspel`,
          description: `Under matchen uppmanas spelarna att gå mot nätet när tillfälle ges.`,
        },
      ],
    },
  ],
};

export const tennisYear3Plan: SeasonPlan = {
  year: 3,
  ageGroup: `9 år`,
  description: `Tredje säsongen fokuserar på matchspel, strategi och teknisk finslipning. Spel på orange bana (¾-storlek).`,
  coachTips: [
    `Introducera enkel matchstrategi – vart man slår och varför.`,
    `Analysera matcher med spelarna.`,
    `Toppsnurr (topspin) och slice kan introduceras.`,
    `Uppmuntra turneringsdeltagande.`,
    `Kom ihåg att ha kul – matchspel ska vara roligt!`,
  ],
  sessions: [
    {
      number: 1,
      title: `Träning 1 – Matchstrategi`,
      activities: [
        {
          name: `Riktade slag`,
          description: `Öva på att slå korsvis och längs linjen. Rikta mot specifika mål på banan.`,
        },
        {
          name: `Taktikdiskussion`,
          description: `Tränaren förklarar grundstrategi: "Spela in, vänta på kortbollen, attackera."`,
        },
        {
          name: `Match med strategifokus`,
          description: `Match där coachen coachar strategi (inte teknik).`,
        },
      ],
    },
    {
      number: 2,
      title: `Träning 2 – Topspin och slice`,
      activities: [
        {
          name: `Topspinintroduktion`,
          description: `Tränaren visar hur man ritar "vindrutetorkaren" vid forehand för att skapa topspin.`,
          tips: `Tips! "Svinga nerifrån och upp – som en skyffel."`,
        },
        {
          name: `Slice backhand`,
          description: `Tränaren visar slice – svinga uppifrån och ned som en "mattkloppar".`,
        },
        {
          name: `Match`,
          description: `Match på orange bana med poängräkning.`,
        },
      ],
    },
    {
      number: 3,
      title: `Träning 3 – Turneringsspel`,
      activities: [
        {
          name: `Turneringssimulering`,
          description: `Intern turnering i round-robin-format. Alla spelar mot alla.`,
        },
        {
          name: `Genomgång`,
          description: `Kort genomgång efteråt – vad fungerade, vad förbättrar vi nästa säsong?`,
        },
      ],
    },
  ],
};
