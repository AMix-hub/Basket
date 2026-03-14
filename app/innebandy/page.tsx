import SportOverviewPage from "../components/SportOverviewPage";

export const metadata = {
  title: "Innebandy Träningsplanering",
  description: "Komplett träningsplanering för innebandycoacher.",
};

const seasons = [
  {
    year: 1,
    href: "ar1",
    ageGroup: "Upp till 7 år",
    accentColor: "border-t-violet-400",
    tagBg: "bg-violet-50 text-violet-700",
    linkColor: "text-violet-700 group-hover:text-violet-800",
    icon: "🌱",
    description:
      "Bollkontroll med klubban och grundläggande rörelseförmåga. Lekfulla övningar med fokus på att ha kul.",
    highlights: ["Klubbkontroll", "Dribbel", "Passningar", "Liten match"],
  },
  {
    year: 2,
    href: "ar2",
    ageGroup: "8 år",
    accentColor: "border-t-purple-500",
    tagBg: "bg-purple-50 text-purple-700",
    linkColor: "text-purple-700 group-hover:text-purple-800",
    icon: "🏑",
    description:
      "Passningsspel, positioner och introduktion av lagtaktik. Laget spelar som en enhet.",
    highlights: ["Triangelpassning", "Positionsspel", "Ge-och-gå", "2v1"],
  },
  {
    year: 3,
    href: "ar3",
    ageGroup: "9 år",
    accentColor: "border-t-fuchsia-500",
    tagBg: "bg-fuchsia-50 text-fuchsia-700",
    linkColor: "text-fuchsia-700 group-hover:text-fuchsia-800",
    icon: "🔥",
    description:
      "Lagsystem, powerplay och avancerade tekniska moment. Taktik och spelförståelse i fokus.",
    highlights: ["Lagsystem", "Powerplay", "Boxplay", "Säsongsavslutning"],
  },
];

export default function InnebandyPage() {
  return (
    <SportOverviewPage
      sportEmoji="🏑"
      sportName="Innebandy"
      sportSlug="innebandy"
      heroFrom="from-purple-600"
      heroAccent="#9333ea"
      heroAccentBg="bg-purple-500/20"
      heroAccentText="text-purple-300"
      tagline={`Träningsplanering\nför innebandycoacher`}
      description="Strukturerade träningspass för barn upp till 9 år – med klubbövningar, passningsspel och matcher för varje tillfälle."
      stats={[
        { value: "3", label: "årsplaner" },
        { value: "36", label: "pass / år" },
        { value: "60", label: "min / pass" },
      ]}
      seasons={seasons}
    />
  );
}
