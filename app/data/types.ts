export type ExerciseTag =
  | "uppvärmning"
  | "kondition"
  | "dribbling"
  | "skytte"
  | "passning"
  | "försvar"
  | "matchspel"
  | "lek"
  | "teknik"
  | "taktik";

export interface Activity {
  name: string;
  description: string;
  tips?: string;
  /** Estimated duration in minutes */
  durationMinutes?: number;
  /** Intensity: 1 = low, 2 = medium, 3 = high */
  intensityLevel?: 1 | 2 | 3;
  /** Category tags for smart-filtering and AI recommendations */
  tags?: ExerciseTag[];
}

export interface Session {
  number: number;
  title: string;
  activities: Activity[];
}

export interface SeasonPlan {
  year: number;
  ageGroup: string;
  description: string;
  coachTips: string[];
  sessions: Session[];
}
