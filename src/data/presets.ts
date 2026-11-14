// "Fill example" scenarios for the create form (SPEC.md section 6.1). Customers come from the seed data.
import type { Category, Channel, Priority } from "../types";

export interface Preset {
  id: string;
  label: string;
  customerId: string;
  channel: Channel;
  category: Category;
  priority?: Priority;
  subject: string;
  body: string;
}

export const PRESETS: Preset[] = [
  {
    id: "enterprise-urgent",
    label: "Enterprise: urgent license failure",
    customerId: "c0033",
    channel: "phone",
    category: "license_activation",
    priority: "urgent",
    subject: "License server rejects all our keys",
    body: "Since this morning our license server rejects every key. Nobody in the office can open Northwind Office Suite. Our whole team cannot work.",
  },
  {
    id: "business-refund",
    label: "Business: refund request",
    customerId: "c0002",
    channel: "email",
    category: "refund",
    subject: "Refund for unused seats",
    body: "We bought 20 seats of Northwind Project Planner but only use 10. Can we get a refund for the other 10? Order NW-2026-482913.",
  },
  {
    id: "dutch-account",
    label: "Dutch customer: account locked",
    customerId: "c0011",
    channel: "web_form",
    category: "account_access",
    subject: "Account locked after password reset",
    body: "My account is locked after I tried to reset my password. I need to download my invoice for my accountant.",
  },
  {
    id: "billing-double",
    label: "Standard: charged twice",
    customerId: "c0001",
    channel: "email",
    category: "billing",
    priority: "high",
    subject: "Charged twice for one order",
    body: "My card was charged twice for order NW-2026-301557. The amount was EUR 89.95 each time. Please refund the double charge.",
  },
  {
    id: "install-low",
    label: "Standard: install question",
    customerId: "c0008",
    channel: "chat",
    category: "download_install",
    priority: "low",
    subject: "Which installer do I need?",
    body: "I am not sure which installer of Northwind PDF Studio I should use on my laptop. There are 32-bit and 64-bit files.",
  },
];
