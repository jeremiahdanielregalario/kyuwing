import { z } from "zod";
import { CATEGORY_LABELS } from "./fees";

export const SKILL_LEVEL_KEYS = [
  "E_MINUS",
  "E",
  "E_PLUS",
  "DE",
  "D_MINUS",
  "D",
  "D_PLUS",
  "CD",
  "C_MINUS",
  "C",
  "C_PLUS",
  "BC",
  "B_MINUS",
  "B",
  "B_PLUS",
  "AB",
  "A_MINUS",
  "A",
  "A_PLUS",
] as const;

export const CATEGORY_KEYS = ["ACTIVE", "ALUMNI", "APPLICANT"] as const;
export const GAMEDAY_TYPE_KEYS = ["REGULAR", "TIPID", "MEGA"] as const;
export const PAYMENT_METHOD_KEYS = ["CASH", "GCASH", "BANK", "OTHER"] as const;

export const playerSchema = z.object({
  nickname: z.string().trim().min(1, "Nickname is required").max(30, "Keep nicknames under 30 characters"),
  fullName: z.string().trim().max(80).optional().nullable(),
  level: z.enum(SKILL_LEVEL_KEYS),
  category: z.enum(CATEGORY_KEYS).default("ACTIVE"),
  contact: z.string().trim().max(60).optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
});

export type PlayerInput = z.infer<typeof playerSchema>;

export const courtSlotSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(30),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  courts: z.coerce.number().int().min(1).max(20),
});

export const gameDayCreateSchema = z.object({
  name: z.string().trim().max(80).optional(),
  venueId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  type: z.enum(GAMEDAY_TYPE_KEYS).default("REGULAR"),
  courtPlan: z.array(courtSlotSchema).min(1).max(8),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const gameDayUpdateSchema = gameDayCreateSchema.partial().extend({
  id: z.string().min(1),
  status: z.enum(["DRAFT", "LIVE", "COMPLETED"]).optional(),
});

export const venueUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  shortName: z.string().trim().min(2).max(10).toUpperCase(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  defaultStart: z.string().regex(/^\d{2}:\d{2}$/),
  defaultEnd: z.string().regex(/^\d{2}:\d{2}$/),
  defaultCourts: z.coerce.number().int().min(1).max(20),
  address: z.string().trim().max(120).optional().nullable(),
});

export const feeRuleSchema = z.object({
  dayType: z.enum(GAMEDAY_TYPE_KEYS),
  category: z.enum(CATEGORY_KEYS),
  flatFee: z.coerce.number().int().min(0).max(100000),
  perGameFee: z.coerce.number().int().min(0).max(100000),
});

export function parseCategory(value: string | undefined | null): (typeof CATEGORY_KEYS)[number] | null {
  if (!value) return "ACTIVE";
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("active") || normalized === "member") return "ACTIVE";
  if (normalized.startsWith("alumni") || normalized.startsWith("inactive")) return "ALUMNI";
  if (normalized.startsWith("applicant")) return "APPLICANT";
  return null;
}

export function categoryLabel(value: (typeof CATEGORY_KEYS)[number]) {
  return CATEGORY_LABELS[value];
}
