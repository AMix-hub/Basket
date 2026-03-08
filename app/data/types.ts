export interface Practice {
  session: number;
  theme: string;
  warmup: string;
  drills: string[];
  game: string;
  cooldown: string;
}

export interface Month {
  month: string;
  focus: string;
  practices: Practice[];
}

export interface SeasonPlan {
  year: number;
  ageGroup: string;
  description: string;
  goals: string[];
  months: Month[];
}
