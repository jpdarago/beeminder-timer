export type Status = "idle" | "running" | "posting" | "finished" | "error";

export type BeeminderGoal = {
  slug: string;
  title?: string;
  gunits?: string;
};

export type StoredSettings = {
  username: string;
  authToken: string;
  goalSlug: string;
};

export type StoredGoals = {
  goals: BeeminderGoal[];
  updatedAt: number; // unix timestamp ms
};

export type StoredTimerState = {
  status: Status;
  remaining: number;
  deadline: number | null;
  paused: boolean;
  goalSlug: string;
  selectedDuration: number;
  comment: string;
};
