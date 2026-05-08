export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface UserSettings {
  id: string;
  planningHorizonDays: number; // 7, 14, etc. (default: 14)
  defaultOfficeDays: {
    seb: DayOfWeek[];
    sherry: DayOfWeek[];
  };
  updatedAt?: Date;
}

export interface UserSettingsFormData {
  planningHorizonDays: number;
  defaultOfficeDays: {
    seb: DayOfWeek[];
    sherry: DayOfWeek[];
  };
}

export const DEFAULT_SETTINGS: Omit<UserSettings, "id" | "updatedAt"> = {
  planningHorizonDays: 14,
  defaultOfficeDays: {
    seb: ["monday", "tuesday", "wednesday", "thursday"],
    sherry: ["monday", "tuesday", "wednesday", "thursday"],
  },
};
