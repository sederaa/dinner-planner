import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { supabase } from "../lib/supabase";
import { DEFAULT_SETTINGS, type DayOfWeek } from "../types/settings";

const WEEKDAY_OPTIONS: Array<{ key: DayOfWeek; label: string }> = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const normalizeDays = (days: unknown, fallback: DayOfWeek[]) => {
  if (!Array.isArray(days)) return fallback;

  const allowed = new Set<DayOfWeek>(WEEKDAY_OPTIONS.map((option) => option.key));
  const normalized = days
    .map((entry) => (typeof entry === "string" ? entry.toLowerCase() : ""))
    .filter((entry): entry is DayOfWeek => allowed.has(entry as DayOfWeek));

  return normalized.length > 0 ? normalized : fallback;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
};

export function SettingsPage() {
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null);
  const [planningHorizonDays, setPlanningHorizonDays] = useState<number>(DEFAULT_SETTINGS.planningHorizonDays);
  const [personAOfficeDays, setPersonAOfficeDays] = useState<DayOfWeek[]>(DEFAULT_SETTINGS.defaultOfficeDays.personA);
  const [personBOfficeDays, setPersonBOfficeDays] = useState<DayOfWeek[]>(DEFAULT_SETTINGS.defaultOfficeDays.personB);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const { data, error } = await (supabase as any).from("user_settings").select("id, planning_horizon_days, default_office_days").limit(1).maybeSingle();
        if (error) throw error;

        setSettingsRowId((data?.id as string | undefined) || null);
        setPlanningHorizonDays(data?.planning_horizon_days === 7 ? 7 : 14);
        setPersonAOfficeDays(normalizeDays(data?.default_office_days?.personA, DEFAULT_SETTINGS.defaultOfficeDays.personA));
        setPersonBOfficeDays(normalizeDays(data?.default_office_days?.personB, DEFAULT_SETTINGS.defaultOfficeDays.personB));
      } catch (loadError) {
        console.error("Error loading settings:", loadError);
        setErrorMessage(getErrorMessage(loadError, "Failed to load settings. Defaults are shown."));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const toggleOfficeDay = (person: "A" | "B", day: DayOfWeek) => {
    const update = (current: DayOfWeek[]) => {
      if (current.includes(day)) {
        return current.filter((entry) => entry !== day);
      }

      return [...current, day];
    };

    if (person === "A") {
      setPersonAOfficeDays((current) => update(current));
      return;
    }

    setPersonBOfficeDays((current) => update(current));
  };

  const saveSettings = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);

    const payload = {
      planning_horizon_days: planningHorizonDays,
      default_office_days: {
        personA: personAOfficeDays,
        personB: personBOfficeDays,
      },
    };

    try {
      if (settingsRowId) {
        const { error } = await (supabase as any).from("user_settings").update(payload).eq("id", settingsRowId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("user_settings").insert(payload).select("id").single();
        if (error) throw error;
        setSettingsRowId(data.id as string);
      }

      setSaveMessage("Settings saved");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (saveError) {
      console.error("Error saving settings:", saveError);
      setErrorMessage(getErrorMessage(saveError, "Failed to save settings."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">🔧 Settings</h2>
        <p className="text-gray-600">Configure your preferences and defaults</p>
      </div>

      <Card className="border-gray-100 shadow-lg">
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="text-lg">User Settings</CardTitle>
          <Button type="button" size="sm" onClick={saveSettings} disabled={loading || saving} className="w-full sm:w-auto">
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {saveMessage && <div className="text-sm text-gray-600">{saveMessage}</div>}
          {errorMessage && <div className="text-sm text-red-700">{errorMessage}</div>}

          {loading ? (
            <div className="text-sm text-gray-500 py-4">Loading settings...</div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Planning Horizon</Label>
                <Select value={String(planningHorizonDays)} onValueChange={(value) => setPlanningHorizonDays(value === "7" ? 7 : 14)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-900">Default Office Days (Next Day)</div>

                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Person A</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {WEEKDAY_OPTIONS.map((day) => (
                      <label key={`person-a-${day.key}`} className="inline-flex items-center gap-2 text-sm">
                        <Checkbox checked={personAOfficeDays.includes(day.key)} onCheckedChange={() => toggleOfficeDay("A", day.key)} />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-gray-600">Person B</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {WEEKDAY_OPTIONS.map((day) => (
                      <label key={`person-b-${day.key}`} className="inline-flex items-center gap-2 text-sm">
                        <Checkbox checked={personBOfficeDays.includes(day.key)} onCheckedChange={() => toggleOfficeDay("B", day.key)} />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
