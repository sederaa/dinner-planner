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

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
};

export function RulesPage() {
  const [rules, setRules] = useState<EditableRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRules = async () => {
    setLoading(true);
    setErrorMessage(null);

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
      setErrorMessage(getErrorMessage(loadError, "Failed to load rules. Showing defaults."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const updateRule = (type: RuleType, updater: (rule: EditableRule) => EditableRule) => {
    setRules((current) => current.map((rule) => (rule.type === type ? updater(rule) : rule)));
  };

  const saveRules = async () => {
    setSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

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
      setErrorMessage(getErrorMessage(saveError, "Failed to save rules."));
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 2000);
    }
  };

  return (
    <div className="page-root">
      <Card className="surface-panel">
        <CardContent>
          <h2 className="page-title">Rules Engine</h2>
          <p className="page-subtitle">Tune scoring behavior used by auto-suggestions and ranking.</p>
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardHeader className="section-header-row">
          <CardTitle>Rule Configuration</CardTitle>
          <div className="section-actions">
            {errorMessage && loading && (
              <Button type="button" size="sm" variant="outline" onClick={loadRules}>
                Retry
              </Button>
            )}
            <Button type="button" size="sm" onClick={saveRules} disabled={loading || saving}>
            {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="page-stack">
          {saveMessage && <div className="state-info">{saveMessage}</div>}
          {errorMessage && <div className="state-error-text">{errorMessage}</div>}

          {loading ? (
            <div className="state-info">Loading rules...</div>
          ) : (
            rules.map((rule) => (
              <div key={rule.type} className="rule-card">
                <div className="form-row-between">
                  <label className="inline-group-item strong-label">
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

                  <div className="input-sm-wrap">
                    <Input
                      type="number"
                      name={`${rule.type}-points`}
                      autoComplete="off"
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
                  <div className="form-row">
                    <div className="muted-text">Max consecutive days:</div>
                    <Input
                      type="number"
                      name="maxConsecutiveDays"
                      autoComplete="off"
                      className="input-xs"
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
                  <div className="form-row">
                    <div className="muted-text">Ingredient:</div>
                    <Input
                      type="text"
                      name="priorityIngredient"
                      autoComplete="off"
                      className="input-md"
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
                  <div className="form-row">
                    <div className="muted-text">Cooldown days:</div>
                    <Input
                      type="number"
                      name="cooldownDays"
                      autoComplete="off"
                      className="input-xs"
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
