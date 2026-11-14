// Plain-English descriptions of rule conditions and actions, for the Admin page.
import { GROUPS } from "../data/config";
import type { Action, Condition, Trigger } from "../types";
import { CATEGORY_LABEL, LANGUAGE_LABEL } from "./format";

const FIELD_LABEL: Record<string, string> = {
  "customer.tier": "customer tier", "customer.language": "customer language", body: "description",
  category: "category", groupId: "group", priority: "priority", channel: "channel", tags: "tags",
};

function valueText(field: string, v: string): string {
  if (field === "category") return CATEGORY_LABEL[v as keyof typeof CATEGORY_LABEL] ?? v;
  if (field === "groupId") return v === "" ? "empty" : GROUPS.find((g) => g.id === v)?.name ?? v;
  if (field === "body") return `"${v}"`;
  if (field === "customer.language") return LANGUAGE_LABEL[v as keyof typeof LANGUAGE_LABEL] ?? v;
  return v;
}

export function describeCondition(c: Condition): string {
  const f = FIELD_LABEL[c.field] ?? c.field;
  const values = (Array.isArray(c.value) ? c.value : [c.value]).map((v) => valueText(c.field, v));
  const op = { is: "is", is_not: "is not", contains: "contains", in: "is one of" }[c.op];
  return `${f} ${op} ${values.join(", ")}`;
}

export function describeConditions(t: Pick<Trigger, "all" | "any">): string {
  const parts: string[] = [];
  if (t.all.length) parts.push(t.all.map(describeCondition).join(" and "));
  if (t.any.length) {
    const anyText = t.any.every((c) => c.field === t.any[0]!.field && c.op === t.any[0]!.op)
      ? `${FIELD_LABEL[t.any[0]!.field] ?? t.any[0]!.field} ${t.any[0]!.op === "contains" ? "contains" : "is"} ${t.any.map((c) => valueText(c.field, String(c.value))).join(" or ")}`
      : t.any.map(describeCondition).join(" or ");
    parts.push(anyText);
  }
  return parts.join(", and ") || "always";
}

export function describeAction(a: Action): string {
  switch (a.type) {
    case "set_group": return `set group ${GROUPS.find((g) => g.id === a.value)?.name ?? a.value}`;
    case "set_priority": return `set priority ${a.value} (if lower)`;
    case "add_tag": return `add tag ${a.value}`;
    case "set_status": return `set status ${a.value.replace("_", "-")}`;
    case "notify_lead": return "notify lead";
    case "add_internal_note": return `add internal note "${a.value}"`;
  }
}

export const describeActions = (actions: Action[]) => actions.map(describeAction).join(", ");

/** Ends a sentence with a full stop, unless it already ends with one (also inside a quote). */
export const sentence = (text: string) => (/[.]"?$/.test(text) ? text : `${text}.`);
