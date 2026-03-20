// Client-safe types for bank hours feature

export type BankHourRequestType = "EXTRA_HOURS" | "OFF_HOURS";

export type BankHourRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface BankHourRequestRow {
  id: string;
  type: BankHourRequestType;
  requesterId: string;
  requesterName: string;
  dateKey: string; // YYYY-MM-DD
  hours: number; // decimal with 2 digits
  justification: string | null;
  status: BankHourRequestStatus;
  adminApprovedAt: string | null; // ISO
  adminRejectedAt: string | null; // ISO
  createdAt: string; // ISO
}

export type BankHoursActionResult = { success: true } | { success: false; error: string };

export const BANK_HOUR_REQUEST_TYPE_LABELS: Record<BankHourRequestType, string> = {
  EXTRA_HOURS: "Horas extras",
  OFF_HOURS: "Folga (banco de horas)",
};

export const BANK_HOUR_REQUEST_STATUS_LABELS: Record<BankHourRequestStatus, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
};

