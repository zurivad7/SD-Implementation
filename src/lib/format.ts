// Display helpers. All times show in Europe/Amsterdam (SPEC.md section 4).
import type { Category, Channel, Priority, Tier } from "../types";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const dateTimeYear = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Amsterdam", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function formatDateTime(value: string | number, withYear = false): string {
  return (withYear ? dateTimeYear : dateTime).format(new Date(value));
}

/** 75 -> "1 h 15 min", 45 -> "45 min", 2000 -> "33 h 20 min". */
export function formatMinutes(mins: number): string {
  const total = Math.round(Math.abs(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export const CHANNEL_LABEL: Record<Channel, string> = { email: "Email", web_form: "Web form", chat: "Chat", phone: "Phone" };
export const CATEGORY_LABEL: Record<Category, string> = {
  license_activation: "License activation", download_install: "Download and install", billing: "Billing",
  refund: "Refund", account_access: "Account access", other: "Other",
};
export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
export const TIER_LABEL: Record<Tier, string> = { standard: "Standard", business: "Business", enterprise: "Enterprise" };
export const LANGUAGE_LABEL = { en: "English", nl: "Dutch", de: "German" } as const;
