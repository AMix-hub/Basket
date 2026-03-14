import SportOverviewPage from "../components/SportOverviewPage";

export const metadata = {
  title: "Handboll Träningsplanering",
  description: "Komplett träningsplanering för handbollscoacher.",
};

const seasons = [
  {
    year: 1,
    href: "ar1",
    ageGroup: "Upp till 7 år",
    accentColor: "border-t-yellow-400",
    tagBg: "bg-yellow-50 text-yellow-700",
    linkColor: "text-yellow-700 group-hover:text-yellow-800",
    icon: "🌱",
    description:
      "Kastglädje, bollkänsla och grundläggande rörelse. Lekfulla övningar som introducerar handbollens grundelement.",
    highlights: ["Bollbekantskap", "Overhandskast", "Fångst", "Minimatch"],
  },
  {
    year: 2,
    href: "ar2",
    ageGroup: "8 år",
    accentColor: "border-t-amber-500",
    tagBg: "bg-amber-50 text-amber-700",
    linkColor: "text-amber-700 group-hover:text-amber-800",
    icon: "🤾",
    description:
      "Passningsspel, skotteknik och grundläggande försvarsspel. Introduktion till lagspel och enkla regler.",
    highlights: ["Passningar", "Skotteknik", "Försvar", "Matchspel"],
  },
  {
    year: 3,
    href: "ar3",
    ageGroup: "9 år",
    accentColor: "border-t-orange-400",
    tagBg: "bg-orange-50 text-orange-700",
    linkColor: "text-orange-700 group-hover:text-orange-800",
    icon: "🔥",
    description:
      "Taktik, anfallsmönster och rollfördelning. Turneringsspel och matchanalys för den moderna handbollsspelaren.",
    highlights: ["Anfallsmönster", "Rollspel", "Försvarstaktik", "Turneringsspel"],
  },
];

export default function HandbollPage() {
  return (
    <SportOverviewPage
      sportEmoji="🤾"
      sportName="Handboll"
      sportSlug="handboll"
      heroFrom="from-yellow-500"
      heroAccent="#eab308"
      heroAccentBg="bg-yellow-500/20"
      heroAccentText="text-yellow-300"
      tagline={`Träningsplanering\nför handbollscoacher`}
      description="Genomtänkta träningspass för juniorer upp till 9 år – med kastövningar, passningsspel och match för varje tillfälle."
      stats={[
        { value: "3", label: "årsplaner" },
        { value: "36", label: "pass / år" },
        { value: "60", label: "min / pass" },
      ]}
      seasons={seasons}
    />
  );
}
