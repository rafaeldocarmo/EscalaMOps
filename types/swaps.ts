// Swap request types (client-safe)

export type SwapType = "OFF_SWAP" | "QUEUE_SWAP" | "ONCALL_SWAP";

export type SwapRequestStatus =
  | "PENDING"
  | "WAITING_SECOND_USER"
  | "SECOND_USER_ACCEPTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface SwapRequestRow {
  id: string;
  type: SwapType;
  requesterId: string;
  requesterName: string;
  targetMemberId: string | null;
  targetMemberName: string | null;
  originalDate: string | null;
  targetDate: string | null;
  status: SwapRequestStatus;
  secondUserAcceptedAt: string | null; // ISO string
  adminApprovedAt: string | null; // ISO string
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export type SwapActionResult = { success: true } | { success: false; error: string };

export type MemberOption = { id: string; name: string };
