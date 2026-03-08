export interface Activity {
  name: string;
  description: string;
  tips?: string;
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
