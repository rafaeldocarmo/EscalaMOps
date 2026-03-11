// Swap request types (client-safe)

export type SwapType = "OFF_SWAP" | "QUEUE_SWAP";

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
  secondUserAcceptedAt: Date | null;
  adminApprovedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SwapActionResult = { success: true } | { success: false; error: string };
