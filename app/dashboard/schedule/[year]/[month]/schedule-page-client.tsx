"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScheduleToolbar } from "@/components/schedule/schedule-toolbar";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import type { ScheduleRow, ScheduleAssignmentRow, SaveAssignmentPayload } from "@/types/schedule";
import type { TeamMemberRow } from "@/types/team";
import {
  assignmentsToStateMap,
  getDaysInMonth,
  dateKey,
  buildScheduleSections,
  getScheduleCalendarDays,
} from "@/lib/scheduleUtils";
import { saveScheduleAssignments } from "@/server/schedule/saveScheduleAssignments";
import { generateAutomaticSchedule } from "@/server/schedule/generateAutomaticSchedule";
import type { ScheduleStateMap } from "@/types/schedule";

interface SchedulePageClientProps {
  schedule: ScheduleRow;
  assignments: ScheduleAssignmentRow[];
  members: TeamMemberRow[];
}

export function SchedulePageClient({
  schedule: initialSchedule,
  assignments: initialAssignments,
  members,
}: SchedulePageClientProps) {
  const router = useRouter();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [stateMap, setStateMap] = useState<ScheduleStateMap>(() =>
    assignmentsToStateMap(initialAssignments)
  );
  const [saveLoading, setSaveLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);

  const dateKeys = useMemo(() => {
    const days = getDaysInMonth(schedule.year, schedule.month);
    return Array.from({ length: days }, (_, i) =>
      dateKey(schedule.year, schedule.month, i + 1)
    );
  }, [schedule.year, schedule.month]);

  const calendarDays = useMemo(
    () => getScheduleCalendarDays(schedule.year, schedule.month),
    [schedule.year, schedule.month]
  );

  const sections = useMemo(
    () => buildScheduleSections(members),
    [members]
  );

  const handleCellToggle = useCallback((memberId: string, dateKeyStr: string) => {
    setStateMap((prev) => {
      const current = prev[memberId]?.[dateKeyStr] ?? "WORK";
      if (current === "SWAP_REQUESTED") return prev;
      const next = current === "WORK" ? "OFF" : "WORK";
      return {
        ...prev,
        [memberId]: {
          ...prev[memberId],
          [dateKeyStr]: next,
        },
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaveLoading(true);
    const payload: SaveAssignmentPayload[] = [];
    for (const member of members) {
      for (const dateStr of dateKeys) {
        payload.push({
          memberId: member.id,
          date: dateStr,
          status: stateMap[member.id]?.[dateStr] ?? "WORK",
        });
      }
    }
    const result = await saveScheduleAssignments(schedule.id, payload);
    setSaveLoading(false);
    if (result.success) {
      toast.success("Alterações salvas.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }, [schedule.id, stateMap, members, dateKeys, router]);

  const handleGenerate = useCallback(async () => {
    setGenerateLoading(true);
    const result = await generateAutomaticSchedule(schedule.id);
    setGenerateLoading(false);
    if (result.success) {
      setStateMap(assignmentsToStateMap(result.assignments));
      toast.success("Escala gerada.");
    } else {
      toast.info(result.error);
    }
  }, [schedule.id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Monthly Schedule
        </h1>
        <ScheduleToolbar
          scheduleId={schedule.id}
          year={schedule.year}
          month={schedule.month}
          onGenerate={handleGenerate}
          onSave={handleSave}
          saveLoading={saveLoading}
          generateLoading={generateLoading}
        />
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Nenhum membro na equipe. Cadastre membros em Equipe para montar a escala.
        </div>
      ) : (
        <ScheduleGrid
          sections={sections}
          calendarDays={calendarDays}
          stateMap={stateMap}
          onCellToggle={handleCellToggle}
          locked={false}
        />
      )}
    </div>
  );
}
