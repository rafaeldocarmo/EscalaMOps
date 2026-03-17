"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScheduleToolbar } from "@/components/schedule/schedule-toolbar";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { SobreavisoTable } from "@/components/schedule/sobreaviso-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ScheduleRow, ScheduleAssignmentRow, SaveAssignmentPayload } from "@/types/schedule";
import type { TeamMemberRow, Level, Shift } from "@/types/team";
import { SHIFT_OPTIONS } from "@/types/team";
import { MultiSelect } from "@/components/ui/multi-select";
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
import { clearScheduleAssignments } from "@/server/schedule/clearScheduleAssignments";
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
  const [schedule] = useState(initialSchedule);
  const [stateMap, setStateMap] = useState<ScheduleStateMap>(() =>
    assignmentsToStateMap(initialAssignments)
  );
  const [hasGenerated, setHasGenerated] = useState(() => initialAssignments.length > 0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [sobreavisoWeeks, setSobreavisoWeeks] = useState(initialSobreavisoWeeks);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedOnCallMemberId, setSelectedOnCallMemberId] = useState<string | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<Level[]>(["N1", "N2"]);
  const [shiftFilter, setShiftFilter] = useState<Shift[]>(SHIFT_OPTIONS.map((s) => s.value));

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

  const scheduleMembersAll = useMemo(() => members, [members]);
  const memberById = useMemo(
    () => new Map(scheduleMembersAll.map((m) => [m.id, m] as const)),
    [scheduleMembersAll]
  );

  const scheduleMembersVisible = useMemo(() => {
    let list = scheduleMembersAll;
    if (levelFilter.length > 0) {
      list = list.filter((m) => levelFilter.includes(m.level));
    } else {
      // treat "none selected" as "all levels"
      list = list;
    }
    if (shiftFilter.length > 0) {
      list = list.filter((m) => shiftFilter.includes(m.shift));
    } else {
      // treat "none selected" as "all shifts"
      list = list;
    }
    return list;
  }, [scheduleMembersAll, levelFilter, shiftFilter]);

  const scheduleMembersRotationOnly = useMemo(
    () => scheduleMembersAll.filter((m) => m.level === "N1" || m.level === "N2"),
    [scheduleMembersAll]
  );

  const sections = useMemo(
    () => buildScheduleSections(scheduleMembersVisible),
    [scheduleMembersVisible]
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
    let nonWorkCount = 0;
    for (const member of scheduleMembersAll) {
      for (const dateStr of dateKeys) {
        const status = stateMap[member.id]?.[dateStr] ?? "WORK";
        if (status !== "WORK") nonWorkCount++;
        payload.push({
          memberId: member.id,
          date: dateStr,
          status,
        });
      }
    }
    const result = await saveScheduleAssignments(schedule.id, payload);
    setSaveLoading(false);
    if (result.success) {
      toast.success("Alterações salvas.");
      setHasGenerated(nonWorkCount > 0);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }, [schedule.id, stateMap, scheduleMembersAll, dateKeys, router]);

  const handleMemberClick = useCallback(async (memberId: string) => {
    if (swapLoading) return;
    const member = memberById.get(memberId);
    if (!member) return;
    if (member.level !== "N1" && member.level !== "N2") {
      toast.info("Troca de posição na fila está disponível apenas para N1/N2.");
      return;
    }
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
  }, [memberById, selectedMemberId, swapLoading, schedule.id]);

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
    if (hasGenerated) {
      toast.info("Esta escala já foi gerada/salva. Use “Limpar tabela” para gerar novamente.");
      return;
    }
    setGenerateLoading(true);
    const result = await generateAutomaticSchedule(schedule.id);
    setGenerateLoading(false);
    if (result.success) {
      setStateMap(assignmentsToStateMap(result.assignments));
      setSobreavisoWeeks(result.sobreavisoWeeks);
      setHasGenerated(true);
      toast.success("Escala gerada.");
    } else {
      toast.info(result.error);
    }
  }, [hasGenerated, schedule.id]);

  const handleClearRequest = useCallback(() => {
    if (clearLoading || saveLoading || generateLoading) return;
    setClearOpen(true);
  }, [clearLoading, saveLoading, generateLoading]);

  const handleClearConfirm = useCallback(async () => {
    setClearLoading(true);
    const result = await clearScheduleAssignments(schedule.id);
    setClearLoading(false);

    if (result.success) {
      setClearOpen(false);
      setSelectedMemberId(null);
      setSelectedOnCallMemberId(null);
      setStateMap({} as ScheduleStateMap);
      setHasGenerated(false);
      toast.success("Tabela limpa.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }, [schedule.id, router]);

  return (
    <div className="space-y-6">
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar tabela</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai limpar a escala do mês (remover folgas salvas) para todos os membros.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleClearConfirm();
              }}
              disabled={clearLoading}
            >
              {clearLoading ? "Limpando…" : "Limpar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          onClear={handleClearRequest}
          generateDisabled={hasGenerated}
          saveLoading={saveLoading}
          generateLoading={generateLoading}
          clearLoading={clearLoading}
          rightContent={
            <>
              <MultiSelect
                label="Níveis"
                options={[
                  { value: "N1", label: "N1" },
                  { value: "N2", label: "N2" },
                  { value: "ESPC", label: "ESPC" },
                  { value: "PRODUCAO", label: "Produção" },
                ]}
                value={levelFilter}
                onChange={setLevelFilter}
                size="sm"
              />
              <MultiSelect
                label="Turnos"
                options={SHIFT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={shiftFilter}
                onChange={setShiftFilter}
                size="sm"
              />
            </>
          }
        />
      </div>

      {scheduleMembersRotationOnly.length === 0 ? (
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
