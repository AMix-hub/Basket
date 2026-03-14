export type SportId = "basket" | "fotboll" | "ishockey" | "innebandy" | "handboll";

export interface SportConfig {
  id: SportId;
  name: string;
  emoji: string;
  description: string;
  /** Tailwind color key (e.g. "orange", "green") */
  color: string;
  accentFrom: string;
  accentTo: string;
}

export const SPORTS: SportConfig[] = [
  {
    id: "basket",
    name: "Basket",
    emoji: "🏀",
    description:
      "Komplett träningsplanering för basketcoacher med fokus på ungdomsutveckling och teknisk progression.",
    color: "orange",
    accentFrom: "from-orange-500",
    accentTo: "to-orange-700",
  },
  {
    id: "fotboll",
    name: "Fotboll",
    emoji: "⚽",
    description:
      "Strukturerad träningsplanering för fotbollscoacher med övningar anpassade för alla åldersgrupper.",
    color: "green",
    accentFrom: "from-green-600",
    accentTo: "to-green-800",
  },
  {
    id: "ishockey",
    name: "Ishockey",
    emoji: "🏒",
    description:
      "Komplett program för ishockeycoacher med fokus på skridskoteknik, puckkontroll och spelförståelse.",
    color: "blue",
    accentFrom: "from-blue-600",
    accentTo: "to-blue-800",
  },
  {
    id: "innebandy",
    name: "Innebandy",
    emoji: "🏑",
    description:
      "Träningsplanering för innebandycoacher med roliga och effektiva övningar för ungdomar.",
    color: "purple",
    accentFrom: "from-purple-600",
    accentTo: "to-purple-800",
  },
  {
    id: "handboll",
    name: "Handboll",
    emoji: "🤾",
    description:
      "Komplett träningsplanering för handbollscoacher med fokus på kast, passningar och lagspel för ungdomar.",
    color: "yellow",
    accentFrom: "from-yellow-500",
    accentTo: "to-yellow-600",
  },
];

export function getSport(id: SportId | string | undefined): SportConfig {
  return SPORTS.find((s) => s.id === id) ?? SPORTS[0];
}
