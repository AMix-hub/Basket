import SportOverviewPage from "../components/SportOverviewPage";

export const metadata = {
  title: "Tennis Träningsplanering",
  description: "Komplett träningsplanering för tenniscoacher.",
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
      "Koordination, bollkänsla och glädje med racketet. Mini-tennis med mjukare bollar och kortare banor.",
    highlights: ["Rackethantering", "Forehand", "Backhand intro", "Minipong"],
  },
  {
    year: 2,
    href: "ar2",
    ageGroup: "8 år",
    accentColor: "border-t-amber-500",
    tagBg: "bg-amber-50 text-amber-700",
    linkColor: "text-amber-700 group-hover:text-amber-800",
    icon: "🎾",
    description:
      "Servintroduktion, konsekvent rall och nätspel. Spel på röd bana (2/3-storlek).",
    highlights: ["Serve", "Rall", "Volley", "Matchspel"],
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
      "Matchstrategi, topspin och turneringsspel. Spel på orange bana (¾-storlek).",
    highlights: ["Strategi", "Topspin", "Slice", "Turneringsspel"],
  },
];

export default function TennisPage() {
  return (
    <SportOverviewPage
      sportEmoji="🎾"
      sportName="Tennis"
      sportSlug="tennis"
      heroFrom="from-yellow-500"
      heroAccent="#eab308"
      heroAccentBg="bg-yellow-500/20"
      heroAccentText="text-yellow-300"
      tagline={`Träningsplanering\nför tenniscoacher`}
      description="Genomtänkta träningspass för juniorer upp till 9 år – med teknikövningar, rall och matcher för varje tillfälle."
      stats={[
        { value: "3", label: "årsplaner" },
        { value: "36", label: "pass / år" },
        { value: "60", label: "min / pass" },
      ]}
      seasons={seasons}
    />
  );
}
