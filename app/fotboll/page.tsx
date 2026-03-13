import SportOverviewPage from "../components/SportOverviewPage";

export const metadata = {
  title: "Fotboll Träningsplanering",
  description: "Komplett träningsplanering för fotbollscoacher.",
};

const seasons = [
  {
    year: 1,
    href: "ar1",
    ageGroup: "Upp till 7 år",
    accentColor: "border-t-emerald-500",
    tagBg: "bg-emerald-50 text-emerald-700",
    linkColor: "text-emerald-700 group-hover:text-emerald-800",
    icon: "🌱",
    description:
      "Glädje, lek och grundläggande bollkänsla. Träningarna introducerar fotbollens grundelement på ett lekfullt sätt.",
    highlights: ["Bollbekantskap", "Dribbel", "Skott på mål", "Liten match"],
  },
  {
    year: 2,
    href: "ar2",
    ageGroup: "8 år",
    accentColor: "border-t-green-500",
    tagBg: "bg-green-50 text-green-700",
    linkColor: "text-green-700 group-hover:text-green-800",
    icon: "⚽",
    description:
      "Passningsspel, positionering och introduktion av lagtaktik. Fokus på att spela som ett lag.",
    highlights: ["Passningar", "Positionsspel", "Ge-och-gå", "Lagtaktik"],
  },
  {
    year: 3,
    href: "ar3",
    ageGroup: "9 år",
    accentColor: "border-t-lime-500",
    tagBg: "bg-lime-50 text-lime-700",
    linkColor: "text-lime-700 group-hover:text-lime-800",
    icon: "🔥",
    description:
      "Taktik, presspel och avancerade tekniska moment. Matchförståelse och speluppfattning i fokus.",
    highlights: ["Presspel", "Set pieces", "Speluppfattning", "Turneringsform"],
  },
];

export default function FotbollPage() {
  return (
    <SportOverviewPage
      sportEmoji="⚽"
      sportName="Fotboll"
      sportSlug="fotboll"
      heroFrom="from-green-600"
      heroAccent="#16a34a"
      heroAccentBg="bg-green-500/20"
      heroAccentText="text-green-300"
      tagline={`Träningsplanering\nför fotbollscoacher`}
      description="Strukturerade träningspass för barn upp till 9 år – med bollövningar, passningsspel och matcher för varje tillfälle."
      stats={[
        { value: "3", label: "årsplaner" },
        { value: "36", label: "pass / år" },
        { value: "60", label: "min / pass" },
      ]}
      seasons={seasons}
    />
  );
}
