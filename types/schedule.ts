// Client-safe schedule types

export type AssignmentStatus = "WORK" | "OFF" | "SWAP_REQUESTED";

export type ScheduleStatus = "OPEN" | "LOCKED";

export interface ScheduleRow {
  id: string;
  month: number;
  year: number;
  status: ScheduleStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleAssignmentRow {
  id: string;
  scheduleId: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  status: AssignmentStatus;
}

/** Map: memberId -> dateKey (YYYY-MM-DD) -> status */
export type ScheduleStateMap = Record<string, Record<string, AssignmentStatus>>;

export interface SaveAssignmentPayload {
  memberId: string;
  date: string; // YYYY-MM-DD
  status: AssignmentStatus;
}
