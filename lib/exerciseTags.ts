import type { Activity, ExerciseTag } from "../app/data/types";

/**
 * Auto-detects category tags for an exercise activity based on keywords
 * found in its name and description. Returns an array of matching tags.
 */
export function autoTag(activity: Activity): ExerciseTag[] {
  if (activity.tags && activity.tags.length > 0) {
    return activity.tags;
  }

  const text = `${activity.name} ${activity.description}`.toLowerCase();
  const tags = new Set<ExerciseTag>();

  // Warm-up / fun games
  if (
    /\b(kull|lek|runda|uppvärm|värmning|jaga|springa|löpa|löpning|rörelse)\b/.test(text)
  ) {
    tags.add("uppvärmning");
  }

  // Conditioning - distinct from warm-up
  if (
    /\b(kondition|uthållighet|intensiv|intensitet)\b/.test(text)
  ) {
    tags.add("kondition");
  }

  // Dribbling
  if (/\b(dribbla|dribbling|studsa|studsar|handbyte|bollen studsar)\b/.test(text)) {
    tags.add("dribbling");
  }

  // Shooting
  if (/\b(skott|skjuta|skjuter|korg|plankan|nätet|mål|fri kast|straffkast)\b/.test(text)) {
    tags.add("skytte");
  }

  // Passing
  if (/\b(pass|passning|passar|kasta till|ge bollen|mottagning)\b/.test(text)) {
    tags.add("passning");
  }

  // Defense
  if (/\b(försvar|blockera|täcka|press|försvars|defensiv|försvarare)\b/.test(text)) {
    tags.add("försvar");
  }

  // Game play
  if (
    /\b(matchspel|match|1v1|2v2|3v3|4v4|5v5|halvplan|fullplan|lag mot lag|spel)\b/.test(text)
  ) {
    tags.add("matchspel");
  }

  // Fun games (especially for younger groups)
  if (/\b(kull|lek|lekar|tävling|poäng|ärtpåsar|vattenflaskor|pinnar)\b/.test(text)) {
    tags.add("lek");
  }

  // Technique
  if (
    /\b(teknik|genomgång|instruktion|lär dig|övning|fint|finter|pivot)\b/.test(text)
  ) {
    tags.add("teknik");
  }

  // Tactics
  if (
    /\b(taktik|mönster|rotation|set-play|position|positionering|offensiv|system)\b/.test(text)
  ) {
    tags.add("taktik");
  }

  return Array.from(tags);
}

export const TAG_LABELS: Record<ExerciseTag, string> = {
  uppvärmning: "Uppvärmning",
  kondition: "Kondition",
  dribbling: "Dribbling",
  skytte: "Skytte",
  passning: "Passning",
  försvar: "Försvar",
  matchspel: "Matchspel",
  lek: "Lek",
  teknik: "Teknik",
  taktik: "Taktik",
};

export const TAG_COLORS: Record<ExerciseTag, string> = {
  uppvärmning: "bg-yellow-100 text-yellow-700",
  kondition: "bg-red-100 text-red-700",
  dribbling: "bg-blue-100 text-blue-700",
  skytte: "bg-orange-100 text-orange-700",
  passning: "bg-purple-100 text-purple-700",
  försvar: "bg-slate-100 text-slate-700",
  matchspel: "bg-emerald-100 text-emerald-700",
  lek: "bg-pink-100 text-pink-700",
  teknik: "bg-cyan-100 text-cyan-700",
  taktik: "bg-indigo-100 text-indigo-700",
};

export const ALL_TAGS: ExerciseTag[] = [
  "uppvärmning",
  "kondition",
  "dribbling",
  "skytte",
  "passning",
  "försvar",
  "matchspel",
  "lek",
  "teknik",
  "taktik",
];
