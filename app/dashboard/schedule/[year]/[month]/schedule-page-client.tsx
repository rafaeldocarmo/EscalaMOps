"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScheduleToolbar } from "@/components/schedule/schedule-toolbar";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { SobreavisoTable } from "@/components/schedule/sobreaviso-table";
import type { ScheduleRow, ScheduleAssignmentRow, SaveAssignmentPayload } from "@/types/schedule";
import type { TeamMemberRow } from "@/types/team";
import type { SobreavisoWeek } from "@/server/sobreaviso/getSobreavisoScheduleForMonth";
import {
  assignmentsToStateMap,
  getDaysInMonth,
  dateKey,
  buildScheduleSections,
  getScheduleCalendarDays,
} from "@/lib/scheduleUtils";
import { saveScheduleAssignments } from "@/server/schedule/saveScheduleAssignments";
import { generateAutomaticSchedule } from "@/server/schedule/generateAutomaticSchedule";
import { adminSwapQueuePositions } from "@/server/schedule/adminSwapQueuePositions";
import { adminSwapOnCallPositions } from "@/server/sobreaviso/adminSwapOnCallPositions";
import type { ScheduleStateMap } from "@/types/schedule";

interface SchedulePageClientProps {
  schedule: ScheduleRow;
  assignments: ScheduleAssignmentRow[];
  members: TeamMemberRow[];
  sobreavisoWeeks: SobreavisoWeek[];
}

export function SchedulePageClient({
  schedule: initialSchedule,
  assignments: initialAssignments,
  members,
  sobreavisoWeeks: initialSobreavisoWeeks,
}: SchedulePageClientProps) {
  const router = useRouter();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [stateMap, setStateMap] = useState<ScheduleStateMap>(() =>
    assignmentsToStateMap(initialAssignments)
  );
  const [saveLoading, setSaveLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [sobreavisoWeeks, setSobreavisoWeeks] = useState(initialSobreavisoWeeks);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedOnCallMemberId, setSelectedOnCallMemberId] = useState<string | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);

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

  const scheduleMembers = useMemo(
    () => members.filter((m) => m.level !== "ESPC" && m.level !== "PRODUCAO"),
    [members]
  );

  const sections = useMemo(
    () => buildScheduleSections(scheduleMembers),
    [scheduleMembers]
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
    for (const member of scheduleMembers) {
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
  }, [schedule.id, stateMap, scheduleMembers, dateKeys, router]);

  const handleMemberClick = useCallback(async (memberId: string) => {
    if (swapLoading) return;
    if (!selectedMemberId) {
      setSelectedMemberId(memberId);
      return;
    }
    if (selectedMemberId === memberId) {
      setSelectedMemberId(null);
      return;
    }
    setSwapLoading(true);
    const result = await adminSwapQueuePositions(selectedMemberId, memberId, schedule.id);
    setSwapLoading(false);
    setSelectedMemberId(null);
    if (result.success) {
      setStateMap((prev) => {
        const next = { ...prev };
        const sliceA = prev[selectedMemberId] ?? {};
        const sliceB = prev[memberId] ?? {};
        next[selectedMemberId] = { ...sliceB };
        next[memberId] = { ...sliceA };
        return next;
      });
      toast.success("Posições na fila trocadas.");
    } else {
      toast.error(result.error ?? "Erro ao trocar posições.");
    }
  }, [selectedMemberId, swapLoading, schedule.id]);

  const handleOnCallMemberClick = useCallback(async (memberId: string) => {
    if (swapLoading) return;
    if (!selectedOnCallMemberId) {
      setSelectedOnCallMemberId(memberId);
      return;
    }
    if (selectedOnCallMemberId === memberId) {
      setSelectedOnCallMemberId(null);
      return;
    }
    setSwapLoading(true);
    const result = await adminSwapOnCallPositions(
      selectedOnCallMemberId, memberId, schedule.year, schedule.month
    );
    setSwapLoading(false);
    setSelectedOnCallMemberId(null);
    if (!result.success) {
      toast.error(result.error ?? "Erro ao trocar posições de sobreaviso.");
      return;
    }
    if (result.sobreavisoWeeks) {
      setSobreavisoWeeks(result.sobreavisoWeeks);
      toast.success("Posições de sobreaviso trocadas.");
    } else {
      toast.error("Erro ao trocar posições de sobreaviso.");
    }
  }, [selectedOnCallMemberId, swapLoading, schedule.year, schedule.month]);

  const handleGenerate = useCallback(async () => {
    setGenerateLoading(true);
    const result = await generateAutomaticSchedule(schedule.id);
    setGenerateLoading(false);
    if (result.success) {
      setStateMap(assignmentsToStateMap(result.assignments));
      setSobreavisoWeeks(result.sobreavisoWeeks);
      toast.success("Escala gerada.");
    } else {
      toast.info(result.error);
    }
  }, [schedule.id, router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Calendário Mensal
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

      {scheduleMembers.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Nenhum membro na equipe. Cadastre membros em Equipe para montar a escala.
        </div>
      ) : (
        <ScheduleGrid
          sections={sections}
          calendarDays={calendarDays}
          stateMap={stateMap}
          onCellToggle={handleCellToggle}
          onMemberClick={handleMemberClick}
          selectedMemberId={selectedMemberId}
          locked={false}
        />
      )}

      <SobreavisoTable
        weeks={sobreavisoWeeks}
        calendarDays={calendarDays}
        onMemberClick={handleOnCallMemberClick}
        selectedMemberId={selectedOnCallMemberId}
      />
    </div>
  );
}
