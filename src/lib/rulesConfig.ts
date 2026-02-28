import { supabase } from "./supabase";
import { DEFAULT_RULES, type Rule, type RuleType } from "../types/rule";

export type RuleConfigRow = {
  id: string;
  name: string;
  enabled: boolean;
  rule_type: RuleType;
  parameters: Record<string, unknown>;
  points: number | null;
};

const parametersFromRule = (rule: Rule): Record<string, unknown> => {
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

const defaultRuleInserts = () => {
  return DEFAULT_RULES.map((rule) => ({
    name: rule.name,
    enabled: rule.enabled,
    rule_type: rule.type,
    points: rule.points ?? 0,
    parameters: parametersFromRule(rule),
  }));
};

export const ensureRulesConfigSeeded = async (): Promise<RuleConfigRow[]> => {
  const { data, error } = await (supabase as any).from("rules_config").select("*");
  if (error) throw error;

  const existingRows = ((data as RuleConfigRow[]) || []).filter((row) => row && row.rule_type);
  const existingTypes = new Set(existingRows.map((row) => row.rule_type));
  const missingRuleTypes = DEFAULT_RULES.filter((rule) => !existingTypes.has(rule.type));

  if (missingRuleTypes.length === 0) {
    return existingRows;
  }

  const inserts = defaultRuleInserts().filter((insertRow) => !existingTypes.has(insertRow.rule_type));
  if (inserts.length > 0) {
    const { error: insertError } = await (supabase as any).from("rules_config").insert(inserts);
    if (insertError) throw insertError;
  }

  const { data: seededData, error: seededError } = await (supabase as any).from("rules_config").select("*");
  if (seededError) throw seededError;

  return (seededData as RuleConfigRow[]) || [];
};
