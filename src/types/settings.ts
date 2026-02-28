export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface UserSettings {
  id: string;
  planningHorizonDays: number; // 7, 14, etc. (default: 14)
  defaultOfficeDays: {
    personA: DayOfWeek[];
    personB: DayOfWeek[];
  };
  updatedAt?: Date;
}

export interface UserSettingsFormData {
  planningHorizonDays: number;
  defaultOfficeDays: {
    personA: DayOfWeek[];
    personB: DayOfWeek[];
  };
}

export const DEFAULT_SETTINGS: Omit<UserSettings, "id" | "updatedAt"> = {
  planningHorizonDays: 14,
  defaultOfficeDays: {
    personA: ["monday", "tuesday", "wednesday", "thursday"],
    personB: ["monday", "tuesday", "wednesday", "thursday"],
  },
};
