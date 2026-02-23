import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { ensureRulesConfigSeeded, type RuleConfigRow } from "../lib/rulesConfig";
import { supabase } from "../lib/supabase";
import { DEFAULT_RULES, type Rule, type RuleType } from "../types/rule";

type EditableRule = {
  id?: string;
  type: RuleType;
  name: string;
  enabled: boolean;
  points: number;
  parameters: Record<string, unknown>;
};

const defaultParametersForRule = (rule: Rule) => {
  if (rule.type === "no_consecutive_same_protein") {
    return { maxConsecutiveDays: rule.maxConsecutiveDays };
  }
  if (rule.type === "prioritize_ingredient") {
    return { ingredient: rule.ingredient };
  }
  if (rule.type === "dish_cooldown_period") {
    return { cooldownDays: rule.cooldownDays };
  }
  return {};
};

const defaultEditableRules: EditableRule[] = DEFAULT_RULES.map((rule) => ({
  type: rule.type,
  name: rule.name,
  enabled: rule.enabled,
  points: rule.points ?? 0,
  parameters: defaultParametersForRule(rule),
}));

const mergeRuleWithRow = (baseRule: EditableRule, row: RuleConfigRow | undefined): EditableRule => {
  if (!row) return baseRule;
  return {
    ...baseRule,
    id: row.id,
    name: row.name || baseRule.name,
    enabled: row.enabled,
    points: row.points ?? baseRule.points,
    parameters: { ...baseRule.parameters, ...(row.parameters || {}) },
  };
};

export function RulesPage() {
  const [rules, setRules] = useState<EditableRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadRules = async () => {
      try {
        const rowsData = await ensureRulesConfigSeeded();

        const rows = ((rowsData as RuleConfigRow[]) || []).reduce<Record<RuleType, RuleConfigRow>>((acc, row) => {
          if (!acc[row.rule_type]) {
            acc[row.rule_type] = row;
          }
          return acc;
        }, {} as Record<RuleType, RuleConfigRow>);

        setRules(defaultEditableRules.map((rule) => mergeRuleWithRow(rule, rows[rule.type])));
      } catch (loadError) {
        console.error("Error loading rules:", loadError);
        setRules(defaultEditableRules);
      } finally {
        setLoading(false);
      }
    };

    loadRules();
  }, []);

  const updateRule = (type: RuleType, updater: (rule: EditableRule) => EditableRule) => {
    setRules((current) => current.map((rule) => (rule.type === type ? updater(rule) : rule)));
  };

  const saveRules = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const savedRules: EditableRule[] = [];

      for (const rule of rules) {
        const payload = {
          name: rule.name,
          enabled: rule.enabled,
          rule_type: rule.type,
          points: rule.points,
          parameters: rule.parameters,
        };

        if (rule.id) {
          const { error } = await (supabase as any).from("rules_config").update(payload).eq("id", rule.id);
          if (error) throw error;
          savedRules.push(rule);
        } else {
          const { data, error } = await (supabase as any).from("rules_config").insert(payload).select("id").single();
          if (error) throw error;
          savedRules.push({ ...rule, id: data.id as string });
        }
      }

      setRules(savedRules);
      setSaveMessage("Rules saved");
    } catch (saveError) {
      console.error("Error saving rules:", saveError);
      setSaveMessage("Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 2000);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">⚙️ Rules Configuration</h2>
        <p className="text-gray-600">Configure rules for meal suggestions</p>
      </div>

      <Card className="border-gray-100 shadow-lg">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Rules</CardTitle>
          <Button type="button" size="sm" onClick={saveRules} disabled={loading || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {saveMessage && <div className="text-sm text-gray-600">{saveMessage}</div>}

          {loading ? (
            <div className="text-sm text-gray-500 py-4">Loading rules...</div>
          ) : (
            rules.map((rule) => (
              <div key={rule.type} className="rounded-md border border-gray-200 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
                    <Checkbox
                      checked={rule.enabled}
                      onCheckedChange={(checked) =>
                        updateRule(rule.type, (current) => ({
                          ...current,
                          enabled: checked === true,
                        }))
                      }
                    />
                    {rule.name}
                  </label>

                  <div className="w-28">
                    <Input
                      type="number"
                      value={String(rule.points)}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        updateRule(rule.type, (current) => ({
                          ...current,
                          points: Number.isFinite(nextValue) ? nextValue : 0,
                        }));
                      }}
                      placeholder="Points"
                    />
                  </div>
                </div>

                {rule.type === "no_consecutive_same_protein" && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-600">Max consecutive days:</div>
                    <Input
                      type="number"
                      className="w-20"
                      value={String((rule.parameters.maxConsecutiveDays as number) ?? 1)}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        updateRule(rule.type, (current) => ({
                          ...current,
                          parameters: {
                            ...current.parameters,
                            maxConsecutiveDays: Number.isFinite(nextValue) ? Math.max(1, nextValue) : 1,
                          },
                        }));
                      }}
                    />
                  </div>
                )}

                {rule.type === "prioritize_ingredient" && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-600">Ingredient:</div>
                    <Input
                      type="text"
                      className="max-w-xs"
                      value={String((rule.parameters.ingredient as string) ?? "")}
                      onChange={(event) => {
                        updateRule(rule.type, (current) => ({
                          ...current,
                          parameters: {
                            ...current.parameters,
                            ingredient: event.target.value,
                          },
                        }));
                      }}
                      placeholder="e.g. beef"
                    />
                  </div>
                )}

                {rule.type === "dish_cooldown_period" && (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-600">Cooldown days:</div>
                    <Input
                      type="number"
                      className="w-20"
                      value={String((rule.parameters.cooldownDays as number) ?? 5)}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        updateRule(rule.type, (current) => ({
                          ...current,
                          parameters: {
                            ...current.parameters,
                            cooldownDays: Number.isFinite(nextValue) ? Math.max(1, nextValue) : 1,
                          },
                        }));
                      }}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
