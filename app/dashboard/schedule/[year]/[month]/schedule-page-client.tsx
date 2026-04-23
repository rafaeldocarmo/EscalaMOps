"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { MemberFormCatalog } from "@/lib/memberFormCatalog";
import {
  initialScheduleLevelFilter,
  initialScheduleShiftFilter,
  levelOptionsForScheduleFilters,
  shiftOptionsForScheduleFilters,
} from "@/lib/scheduleMemberFilterOptions";
import type { TeamMemberRow } from "@/types/team";
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
import { generateSobreavisoForMonth } from "@/server/sobreaviso/generateSobreavisoForMonth";
import { clearSobreavisoForMonth } from "@/server/sobreaviso/clearSobreavisoForMonth";
import { clearScheduleAssignments } from "@/server/schedule/clearScheduleAssignments";
import { adminSwapQueuePositions } from "@/server/schedule/adminSwapQueuePositions";
import { adminSwapOnCallPositions } from "@/server/sobreaviso/adminSwapOnCallPositions";
import { adminBackCycleRotationQueueForAllMembers } from "@/server/schedule/adminBackCycleRotationQueueForAllMembers";
import type { ScheduleStateMap } from "@/types/schedule";
import { Button } from "@/components/ui/button";
import { getShiftSwapRequestsForMonth } from "@/server/swaps/getShiftSwapRequestsForMonth";
import { getApprovedOffHoursWithdrawnDatesForMonth } from "@/server/bank-hours/getApprovedOffHoursWithdrawnDatesForMonth";
import { exportScheduleToExcel } from "@/lib/exportScheduleToExcel";

interface SchedulePageClientProps {
  schedule: ScheduleRow;
  assignments: ScheduleAssignmentRow[];
  members: TeamMemberRow[];
  sobreavisoWeeks: SobreavisoWeek[];
  /** Alinha gerar/limpar/trocar sobreaviso com a equipe do TeamSwitcher (?teamId=). */
  selectedTeamId?: string | null;
  /** Filtros de nível/turno alinhados ao catálogo em Configurações → Níveis e turnos. */
  memberFormCatalog: MemberFormCatalog | null;
}

export function SchedulePageClient({
  schedule: initialSchedule,
  assignments: initialAssignments,
  members,
  sobreavisoWeeks: initialSobreavisoWeeks,
  selectedTeamId = null,
  memberFormCatalog,
}: SchedulePageClientProps) {
  const router = useRouter();
  const [schedule] = useState(initialSchedule);
  const [stateMap, setStateMap] = useState<ScheduleStateMap>(() =>
    assignmentsToStateMap(initialAssignments)
  );
  const [hasGenerated, setHasGenerated] = useState(() => initialAssignments.length > 0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateSobreavisoLoading, setGenerateSobreavisoLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearSobreavisoLoading, setClearSobreavisoLoading] = useState(false);
  const [clearSobreavisoOpen, setClearSobreavisoOpen] = useState(false);
  const [sobreavisoWeeks, setSobreavisoWeeks] = useState(initialSobreavisoWeeks);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedOnCallMemberId, setSelectedOnCallMemberId] = useState<string | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [backCycleLoading, setBackCycleLoading] = useState(false);
  const [shiftSwapPurpleByMemberId, setShiftSwapPurpleByMemberId] = useState<Record<string, string[]>>({});
  const [hoursWithdrawnOrangeByMemberId, setHoursWithdrawnOrangeByMemberId] = useState<Record<string, string[]>>({});
  const [levelFilter, setLevelFilter] = useState<string[]>(() =>
    initialScheduleLevelFilter(memberFormCatalog),
  );
  const [shiftFilter, setShiftFilter] = useState<string[]>(() =>
    initialScheduleShiftFilter(memberFormCatalog),
  );

  useEffect(() => {
    setLevelFilter(initialScheduleLevelFilter(memberFormCatalog));
    setShiftFilter(initialScheduleShiftFilter(memberFormCatalog));
  }, [memberFormCatalog]);

  const levelFilterSelectOptions = useMemo(
    () => levelOptionsForScheduleFilters(memberFormCatalog),
    [memberFormCatalog],
  );
  const shiftFilterSelectOptions = useMemo(
    () => shiftOptionsForScheduleFilters(memberFormCatalog),
    [memberFormCatalog],
  );

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

  useEffect(() => {
    getShiftSwapRequestsForMonth(schedule.year, schedule.month).then((list) => {
      const map: Record<string, string[]> = {};
      for (const r of list) {
        if (!map[r.requesterId]) map[r.requesterId] = [];
        map[r.requesterId].push(r.originalDate);
      }
      setShiftSwapPurpleByMemberId(map);
    });
  }, [schedule.year, schedule.month]);

  useEffect(() => {
    getApprovedOffHoursWithdrawnDatesForMonth(schedule.year, schedule.month).then((map) => {
      setHoursWithdrawnOrangeByMemberId(map);
    });
  }, [schedule.year, schedule.month]);

  useEffect(() => {
    const handler = () => {
      // Atualiza também OFF completo (8h) na escala.
      router.refresh();
      getApprovedOffHoursWithdrawnDatesForMonth(schedule.year, schedule.month).then(setHoursWithdrawnOrangeByMemberId);
    };

    window.addEventListener("bank-hours-updated", handler);
    return () => window.removeEventListener("bank-hours-updated", handler);
  }, [router, schedule.year, schedule.month]);

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m] as const)),
    [members]
  );

  const scheduleMembersOnly = useMemo(
    () => members.filter((m) => m.participatesInSchedule !== false),
    [members]
  );

  const scheduleMembersVisible = useMemo(() => {
    let list = scheduleMembersOnly;
    if (levelFilter.length > 0) {
      list = list.filter((m) => levelFilter.includes(m.teamLevelId));
    }
    if (shiftFilter.length > 0) {
      list = list.filter((m) => shiftFilter.includes(m.teamShiftId));
    }
    return list;
  }, [scheduleMembersOnly, levelFilter, shiftFilter]);

  const scheduleMembersRotationOnly = useMemo(
    () => scheduleMembersOnly,
    [scheduleMembersOnly]
  );

  const sections = useMemo(
    () => buildScheduleSections(scheduleMembersVisible),
    [scheduleMembersVisible]
  );

  const sobreavisoEligibleMembers = useMemo(
    () =>
      members
        .filter((m) => m.sobreaviso)
        .map((m) => ({ id: m.id, name: m.name, level: m.levelLabel })),
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
    let nonWorkCount = 0;
    for (const member of members) {
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
  }, [schedule.id, stateMap, members, dateKeys, router]);

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
      selectedOnCallMemberId,
      memberId,
      schedule.year,
      schedule.month,
      selectedTeamId ?? undefined
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
  }, [selectedOnCallMemberId, swapLoading, schedule.year, schedule.month, selectedTeamId]);

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

  const handleGenerateSobreaviso = useCallback(async () => {
    setGenerateSobreavisoLoading(true);
    const result = await generateSobreavisoForMonth(
      schedule.month,
      schedule.year,
      selectedTeamId ?? undefined
    );
    setGenerateSobreavisoLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Erro ao gerar sobreaviso.");
      return;
    }
    setSobreavisoWeeks(result.sobreavisoWeeks);
    toast.success("Sobreaviso gerado.");
  }, [schedule.month, schedule.year, selectedTeamId]);

  const handleClearRequest = useCallback(() => {
    if (clearLoading || saveLoading || generateLoading) return;
    setClearOpen(true);
  }, [clearLoading, saveLoading, generateLoading]);

  const handleClearSobreavisoRequest = useCallback(() => {
    if (clearSobreavisoLoading || generateSobreavisoLoading) return;
    setClearSobreavisoOpen(true);
  }, [clearSobreavisoLoading, generateSobreavisoLoading]);

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

  const handleClearSobreavisoConfirm = useCallback(async () => {
    setClearSobreavisoLoading(true);
    const result = await clearSobreavisoForMonth(
      schedule.month,
      schedule.year,
      selectedTeamId ?? undefined
    );
    setClearSobreavisoLoading(false);

    if (!result.success) {
      toast.error(result.error ?? "Erro ao limpar sobreaviso.");
      return;
    }

    setClearSobreavisoOpen(false);
    setSelectedOnCallMemberId(null);
    setSobreavisoWeeks(result.sobreavisoWeeks);
    toast.success("Sobreaviso limpo.");
  }, [schedule.month, schedule.year, selectedTeamId, setSelectedOnCallMemberId]);

  const handleBackScale = useCallback(async () => {
    if (backCycleLoading || clearLoading || saveLoading || generateLoading) return;
    setBackCycleLoading(true);
    const result = await adminBackCycleRotationQueueForAllMembers(schedule.id);
    setBackCycleLoading(false);
    if (!result.success) {
      toast.error(result.error ?? "Erro ao voltar a escala.");
      return;
    }
    setStateMap(assignmentsToStateMap(result.assignments));
    setSobreavisoWeeks(result.sobreavisoWeeks);
    setHasGenerated(true);
    setSelectedMemberId(null);
    setSelectedOnCallMemberId(null);
    toast.success("Escala recuada (voltar a fila).");
  }, [
    backCycleLoading,
    clearLoading,
    saveLoading,
    generateLoading,
    schedule.id,
  ]);

  const handleExportExcel = useCallback(async () => {
    await exportScheduleToExcel(schedule.year, schedule.month, members, stateMap, sobreavisoWeeks);
    toast.success("Planilha exportada.");
  }, [schedule.year, schedule.month, members, stateMap, sobreavisoWeeks]);

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

      <AlertDialog open={clearSobreavisoOpen} onOpenChange={setClearSobreavisoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar sobreaviso</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai limpar o sobreaviso do mês (remover sobreaviso gerado) para todos os níveis.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearSobreavisoLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleClearSobreavisoConfirm();
              }}
              disabled={clearSobreavisoLoading}
            >
              {clearSobreavisoLoading ? "Limpando…" : "Limpar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Calendário Mensal
        </h1>
        <ScheduleToolbar
          year={schedule.year}
          month={schedule.month}
          onGenerate={handleGenerate}
          onSave={handleSave}
          onClear={handleClearRequest}
          onExportExcel={handleExportExcel}
          generateDisabled={hasGenerated}
          saveLoading={saveLoading}
          generateLoading={generateLoading}
          clearLoading={clearLoading}
          rightContent={
            <>
              <MultiSelect
                label="Níveis"
                options={levelFilterSelectOptions}
                value={levelFilter}
                onChange={setLevelFilter}
                size="sm"
              />
              <MultiSelect
                label="Turnos"
                options={shiftFilterSelectOptions}
                value={shiftFilter}
                onChange={setShiftFilter}
                size="sm"
              />
            </>
          }
        />
        {!memberFormCatalog ? (
          <p className="text-xs text-amber-700 dark:text-amber-500">
            Cadastre níveis e turnos da equipe em Configurações para habilitar filtros com os rótulos do catálogo. Sem
            catálogo, todos os membros entram na grade.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleBackScale()}
          disabled={
            backCycleLoading ||
            clearLoading ||
            saveLoading ||
            generateLoading ||
            scheduleMembersRotationOnly.length === 0
          }
        >
          {backCycleLoading ? "Ajustando…" : "Voltar a escala"}
        </Button>
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
          shiftSwapPurpleByMemberId={shiftSwapPurpleByMemberId}
          hoursWithdrawnOrangeByMemberId={hoursWithdrawnOrangeByMemberId}
          onCellToggle={handleCellToggle}
          onMemberClick={handleMemberClick}
          selectedMemberId={selectedMemberId}
          locked={false}
        />
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Sobreaviso</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearSobreavisoRequest}
              disabled={clearSobreavisoLoading || generateSobreavisoLoading}
            >
              {clearSobreavisoLoading ? "Limpando…" : "Limpar sobreaviso"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateSobreaviso}
              disabled={generateSobreavisoLoading || sobreavisoWeeks.length > 0}
              title={sobreavisoWeeks.length > 0 ? "Limpe o sobreaviso do mês para gerar novamente." : undefined}
            >
              {generateSobreavisoLoading ? "Gerando…" : "Gerar Sobreaviso"}
            </Button>
          </div>
        </div>
        <SobreavisoTable
          weeks={sobreavisoWeeks}
          calendarDays={calendarDays}
          eligibleMembers={sobreavisoEligibleMembers}
          onMemberClick={handleOnCallMemberClick}
          selectedMemberId={selectedOnCallMemberId}
        />
      </div>
    </div>
  );
}
