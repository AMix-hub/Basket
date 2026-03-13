import SportOverviewPage from "../components/SportOverviewPage";

export const metadata = {
  title: "Ishockey Träningsplanering",
  description: "Komplett träningsplanering för ishockeycoacher.",
};

const seasons = [
  {
    year: 1,
    href: "ar1",
    ageGroup: "Upp till 7 år",
    accentColor: "border-t-sky-400",
    tagBg: "bg-sky-50 text-sky-700",
    linkColor: "text-sky-700 group-hover:text-sky-800",
    icon: "🌱",
    description:
      "Skridskoglädje och grundläggande skridskoåkning. Lekfulla övningar på isen med fokus på puckkontroll.",
    highlights: ["Skridskoåkning", "Puckkontroll", "Passningar", "Liten match"],
  },
  {
    year: 2,
    href: "ar2",
    ageGroup: "8 år",
    accentColor: "border-t-blue-500",
    tagBg: "bg-blue-50 text-blue-700",
    linkColor: "text-blue-700 group-hover:text-blue-800",
    icon: "🏒",
    description:
      "Bakåtåkning, avslut och introduktion av lagtaktik. Övningar på att spela som ett lag.",
    highlights: ["Bakåtåkning", "Wristshot", "Positioner", "2v1-övningar"],
  },
  {
    year: 3,
    href: "ar3",
    ageGroup: "9 år",
    accentColor: "border-t-indigo-500",
    tagBg: "bg-indigo-50 text-indigo-700",
    linkColor: "text-indigo-700 group-hover:text-indigo-800",
    icon: "🔥",
    description:
      "Lagsystem, powerplay och avancerade tekniska moment. Taktik och matchförståelse i fokus.",
    highlights: ["Lagsystem", "Powerplay", "Deflektioner", "Matchsimulering"],
  },
];

export default function IshockeyPage() {
  return (
    <SportOverviewPage
      sportEmoji="🏒"
      sportName="Ishockey"
      sportSlug="ishockey"
      heroFrom="from-blue-600"
      heroAccent="#2563eb"
      heroAccentBg="bg-blue-500/20"
      heroAccentText="text-blue-300"
      tagline={`Träningsplanering\nför ishockeycoacher`}
      description="Kompletta träningspass för barn upp till 9 år – med skridskoövningar, puckkontroll och matchspel för varje tillfälle."
      stats={[
        { value: "3", label: "årsplaner" },
        { value: "36", label: "pass / år" },
        { value: "60", label: "min / pass" },
      ]}
      seasons={seasons}
    />
  );
}
