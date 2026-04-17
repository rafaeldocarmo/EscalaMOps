"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  TeamLevelShiftCatalogData,
  TeamCatalogLevelRow,
  TeamCatalogShiftRow,
} from "@/server/team/getTeamLevelShiftCatalog";
import { createTeamLevel } from "@/server/team/createTeamLevel";
import { createTeamShift } from "@/server/team/createTeamShift";
import { updateTeamLevel } from "@/server/team/updateTeamLevel";
import { updateTeamShift } from "@/server/team/updateTeamShift";
import { deleteTeamLevel } from "@/server/team/deleteTeamLevel";
import { deleteTeamShift } from "@/server/team/deleteTeamShift";
import { replaceAllowedShiftsForTeamLevel } from "@/server/team/replaceAllowedShiftsForTeamLevel";
import type { Level, Shift } from "@/types/team";

interface TeamCatalogPageClientProps {
  initialData: TeamLevelShiftCatalogData;
}

type EntityVariant = "level" | "shift";
type CatalogRow = TeamCatalogLevelRow | TeamCatalogShiftRow;

type ItemDialogState =
  | { open: false }
  | { open: true; variant: EntityVariant; mode: "create"; row?: undefined }
  | { open: true; variant: "level"; mode: "edit"; row: TeamCatalogLevelRow }
  | { open: true; variant: "shift"; mode: "edit"; row: TeamCatalogShiftRow };

type DeleteState =
  | { open: false }
  | { open: true; variant: EntityVariant; row: CatalogRow };

const LEGACY_LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "N1", label: "N1" },
  { value: "N2", label: "N2" },
  { value: "ESPC", label: "Especialista (ESPC)" },
  { value: "PRODUCAO", label: "Produção" },
];

const LEGACY_SHIFT_OPTIONS: { value: Shift; label: string }[] = [
  { value: "T1", label: "T1" },
  { value: "T2", label: "T2" },
  { value: "T3", label: "T3" },
  { value: "TC", label: "TC" },
];

const CUSTOM_LEGACY_KIND_VALUE = "__custom__";

function legacyKindBadge(legacyKind: Level | Shift | null, variant: EntityVariant): string {
  if (!legacyKind) return "Personalizado";
  if (variant === "level") {
    return LEGACY_LEVEL_OPTIONS.find((o) => o.value === legacyKind)?.label ?? String(legacyKind);
  }
  return LEGACY_SHIFT_OPTIONS.find((o) => o.value === legacyKind)?.label ?? String(legacyKind);
}

function pairIndex(pairs: { teamLevelId: string; teamShiftId: string }[]) {
  const byLevel = new Map<string, Set<string>>();
  for (const p of pairs) {
    if (!byLevel.has(p.teamLevelId)) byLevel.set(p.teamLevelId, new Set());
    byLevel.get(p.teamLevelId)!.add(p.teamShiftId);
  }
  return byLevel;
}

function sortCatalogRows(a: CatalogRow, b: CatalogRow) {
  return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
}

function useSyncedIdOrder(rows: CatalogRow[]) {
  const [order, setOrder] = useState<string[]>([]);
  const syncKey = useMemo(
    () =>
      [...rows]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((r) => `${r.id}:${r.sortOrder}`)
        .join("|"),
    [rows],
  );
  useEffect(() => {
    const sorted = [...rows].sort(sortCatalogRows);
    setOrder(sorted.map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só realinhar quando o snapshot do servidor mudar (syncKey)
  }, [syncKey]);
  return [order, setOrder] as const;
}

function SortableCatalogRow({
  row,
  disabled,
  entityLabel,
  variant,
  onEdit,
  onDelete,
}: {
  row: CatalogRow;
  disabled: boolean;
  entityLabel: "nível" | "turno";
  variant: EntityVariant;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-10 p-2 text-muted-foreground">
        <button
          type="button"
          className="flex h-8 w-8 cursor-grab touch-manipulation items-center justify-center rounded-md border border-transparent hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Reordenar ${entityLabel} ${row.label}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 shrink-0" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{row.label}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <span
          className={
            row.legacyKind
              ? "inline-flex items-center rounded-md bg-muted px-2 py-0.5"
              : "inline-flex items-center rounded-md border border-dashed border-border px-2 py-0.5 italic"
          }
          title={
            row.legacyKind
              ? "Tipo do sistema: entra nas regras automáticas de escala e sobreaviso."
              : "Personalizado: aparece no catálogo, mas ainda não entra no cadastro de membros nem nas regras de escala."
          }
        >
          {legacyKindBadge(row.legacyKind, variant)}
        </span>
      </TableCell>
      <TableCell className="w-28 text-right">
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 cursor-pointer"
            aria-label={`Editar ${entityLabel} ${row.label}`}
            disabled={disabled}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive"
            aria-label={`Excluir ${entityLabel} ${row.label}`}
            disabled={disabled}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CatalogSortableTable({
  entityLabel,
  variant,
  orderedRows,
  busy,
  onReorder,
  onEdit,
  onDelete,
}: {
  entityLabel: "nível" | "turno";
  variant: EntityVariant;
  orderedRows: CatalogRow[];
  busy: boolean;
  onReorder: (orderedIds: string[]) => void;
  onEdit: (row: CatalogRow) => void;
  onDelete: (row: CatalogRow) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => orderedRows.map((r) => r.id), [orderedRows]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    onReorder(next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" />
            <TableHead>Nome</TableHead>
            <TableHead className="w-44">Tipo do sistema</TableHead>
            <TableHead className="w-28 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {orderedRows.map((row) => (
              <SortableCatalogRow
                key={row.id}
                row={row}
                disabled={busy}
                entityLabel={entityLabel}
                variant={variant}
                onEdit={() => onEdit(row)}
                onDelete={() => onDelete(row)}
              />
            ))}
          </SortableContext>
        </TableBody>
      </Table>
    </DndContext>
  );
}

export function TeamCatalogPageClient({ initialData }: TeamCatalogPageClientProps) {
  const router = useRouter();
  const [itemDialog, setItemDialog] = useState<ItemDialogState>({ open: false });
  const [deleteState, setDeleteState] = useState<DeleteState>({ open: false });
  const [matrixBusy, setMatrixBusy] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState<"levels" | "shifts" | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const levels = initialData.levels;
  const shifts = initialData.shifts;
  const [levelOrder, setLevelOrder] = useSyncedIdOrder(levels);
  const [shiftOrder, setShiftOrder] = useSyncedIdOrder(shifts);

  const pairsByLevel = useMemo(() => pairIndex(initialData.allowedPairs), [initialData.allowedPairs]);
  const teamId = initialData.teamId;

  const levelsOrdered = useMemo(() => {
    const map = new Map(levels.map((l) => [l.id, l]));
    return levelOrder
      .map((id) => map.get(id))
      .filter((r): r is TeamCatalogLevelRow => r != null);
  }, [levels, levelOrder]);

  const shiftsOrdered = useMemo(() => {
    const map = new Map(shifts.map((s) => [s.id, s]));
    return shiftOrder
      .map((id) => map.get(id))
      .filter((r): r is TeamCatalogShiftRow => r != null);
  }, [shifts, shiftOrder]);

  async function persistLevelOrder(orderedIds: string[]) {
    setLevelOrder(orderedIds);
    setReorderBusy("levels");
    try {
      const results = await Promise.all(
        orderedIds.map((id, index) => updateTeamLevel({ id, sortOrder: index })),
      );
      const failed = results.find((r) => !r.success);
      if (failed && !failed.success) {
        toast.error(failed.error);
        refresh();
        return;
      }
      toast.success("Ordem dos níveis atualizada.");
      refresh();
    } finally {
      setReorderBusy(null);
    }
  }

  async function persistShiftOrder(orderedIds: string[]) {
    setShiftOrder(orderedIds);
    setReorderBusy("shifts");
    try {
      const results = await Promise.all(
        orderedIds.map((id, index) => updateTeamShift({ id, sortOrder: index })),
      );
      const failed = results.find((r) => !r.success);
      if (failed && !failed.success) {
        toast.error(failed.error);
        refresh();
        return;
      }
      toast.success("Ordem dos turnos atualizada.");
      refresh();
    } finally {
      setReorderBusy(null);
    }
  }

  async function handleMatrixToggle(levelId: string, shiftId: string, checked: boolean) {
    const key = `${levelId}:${shiftId}`;
    setMatrixBusy(key);
    const current = Array.from(pairsByLevel.get(levelId) ?? []);
    const next = checked
      ? [...new Set([...current, shiftId])]
      : current.filter((id) => id !== shiftId);

    const result = await replaceAllowedShiftsForTeamLevel({
      teamLevelId: levelId,
      teamShiftIds: next,
    });
    setMatrixBusy(null);
    if (result.success) {
      toast.success("Compatibilidade atualizada.");
      refresh();
    } else {
      toast.error(result.error ?? "Não foi possível salvar.");
    }
  }

  const matrixDisabled = levelsOrdered.length === 0 || shiftsOrdered.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Níveis e turnos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre os níveis e turnos que serão usados pela equipe. O campo{" "}
          <span className="font-medium">Tipo do sistema</span> amarra a entrada a uma regra existente
          de escala/sobreaviso (N1, N2, ESPC, PRODUCAO, T1, T2, T3, TC). Níveis e turnos{" "}
          <span className="italic">Personalizados</span> aparecem no catálogo, mas ainda não entram
          no cadastro de membros nem nas regras automáticas — serão habilitados quando a
          parametrização de regras for implementada. Arraste pelo ícone à esquerda para reordenar e
          use a matriz abaixo para definir combinações permitidas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border/50 pb-4">
            <div>
              <CardTitle className="text-lg font-bold">Níveis</CardTitle>
              <CardDescription>Nome único por equipe, alinhado ao cadastro de membros.</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer bg-foreground text-background hover:bg-foreground/90"
              onClick={() => setItemDialog({ open: true, variant: "level", mode: "create" })}
            >
              <Plus className="mr-1 h-4 w-4" />
              Novo
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {levels.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum nível cadastrado.</p>
            ) : (
              <CatalogSortableTable
                entityLabel="nível"
                variant="level"
                orderedRows={levelsOrdered}
                busy={reorderBusy === "levels"}
                onReorder={(ids) => void persistLevelOrder(ids)}
                onEdit={(row) =>
                  setItemDialog({
                    open: true,
                    variant: "level",
                    mode: "edit",
                    row: row as TeamCatalogLevelRow,
                  })
                }
                onDelete={(row) => setDeleteState({ open: true, variant: "level", row })}
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border/50 pb-4">
            <div>
              <CardTitle className="text-lg font-bold">Turnos</CardTitle>
              <CardDescription>Nome único por equipe, alinhado ao cadastro de membros.</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer bg-foreground text-background hover:bg-foreground/90"
              onClick={() => setItemDialog({ open: true, variant: "shift", mode: "create" })}
            >
              <Plus className="mr-1 h-4 w-4" />
              Novo
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {shifts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum turno cadastrado.</p>
            ) : (
              <CatalogSortableTable
                entityLabel="turno"
                variant="shift"
                orderedRows={shiftsOrdered}
                busy={reorderBusy === "shifts"}
                onReorder={(ids) => void persistShiftOrder(ids)}
                onEdit={(row) =>
                  setItemDialog({
                    open: true,
                    variant: "shift",
                    mode: "edit",
                    row: row as TeamCatalogShiftRow,
                  })
                }
                onDelete={(row) => setDeleteState({ open: true, variant: "shift", row })}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-lg font-bold">Compatibilidade</CardTitle>
          <CardDescription>
            Marque em quais turnos cada nível pode trabalhar. Linha = nível; coluna = turno.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {matrixDisabled ? (
            <p className="text-sm text-muted-foreground">
              Cadastre ao menos um nível e um turno para editar a matriz.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-[140px] bg-card">Nível</TableHead>
                    {shiftsOrdered.map((s) => (
                      <TableHead key={s.id} className="min-w-[100px] text-center">
                        <span className="font-medium">{s.label}</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levelsOrdered.map((lv) => (
                    <TableRow key={lv.id}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium">{lv.label}</TableCell>
                      {shiftsOrdered.map((sh) => {
                        const checked = pairsByLevel.get(lv.id)?.has(sh.id) ?? false;
                        const busy = matrixBusy === `${lv.id}:${sh.id}`;
                        return (
                          <TableCell key={sh.id} className="text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer accent-foreground disabled:opacity-50"
                              checked={checked}
                              disabled={busy}
                              onChange={(e) => handleMatrixToggle(lv.id, sh.id, e.target.checked)}
                              aria-label={`${lv.label} em ${sh.label}`}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CatalogItemDialog
        itemDialog={itemDialog}
        onOpenChange={(open) => {
          if (!open) setItemDialog({ open: false });
        }}
        teamId={teamId}
        nextLevelSortOrder={levelsOrdered.length}
        nextShiftSortOrder={shiftsOrdered.length}
        onSuccess={() => {
          setItemDialog({ open: false });
          toast.success("Salvo.");
          refresh();
        }}
      />

      <CatalogDeleteDialog
        state={deleteState}
        onOpenChange={(open) => {
          if (!open) setDeleteState({ open: false });
        }}
        onSuccess={() => {
          setDeleteState({ open: false });
          toast.success("Removido.");
          refresh();
        }}
      />
    </div>
  );
}

function CatalogItemDialog({
  itemDialog,
  onOpenChange,
  teamId,
  nextLevelSortOrder,
  nextShiftSortOrder,
  onSuccess,
}: {
  itemDialog: ItemDialogState;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  nextLevelSortOrder: number;
  nextShiftSortOrder: number;
  onSuccess: () => void;
}) {
  const open = itemDialog.open;
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  /** `null` = personalizado (sem legacyKind). Stored as string for the Select. */
  const [legacyKind, setLegacyKind] = useState<string>(CUSTOM_LEGACY_KIND_VALUE);
  const [error, setError] = useState<string | null>(null);

  const variant = itemDialog.open ? itemDialog.variant : "level";
  const mode = itemDialog.open ? itemDialog.mode : "create";
  const editRow = itemDialog.open && itemDialog.mode === "edit" ? itemDialog.row : undefined;

  useEffect(() => {
    if (!itemDialog.open) return;
    if (itemDialog.mode === "edit") {
      const r = itemDialog.row;
      setLabel(r.label);
      setLegacyKind(r.legacyKind ?? CUSTOM_LEGACY_KIND_VALUE);
    } else {
      setLabel("");
      setLegacyKind(CUSTOM_LEGACY_KIND_VALUE);
    }
    setError(null);
  }, [itemDialog]);

  const options = variant === "level" ? LEGACY_LEVEL_OPTIONS : LEGACY_SHIFT_OPTIONS;
  const legacyKindForSubmit: Level | Shift | null =
    legacyKind === CUSTOM_LEGACY_KIND_VALUE ? null : (legacyKind as Level | Shift);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const createSortOrder = variant === "level" ? nextLevelSortOrder : nextShiftSortOrder;

    try {
      if (variant === "level") {
        if (mode === "create") {
          const r = await createTeamLevel({
            teamId,
            label: label.trim(),
            legacyKind: legacyKindForSubmit as Level | null,
            sortOrder: createSortOrder,
          });
          if (!r.success) {
            setError(r.error);
            setLoading(false);
            return;
          }
        } else if (editRow) {
          const r = await updateTeamLevel({
            id: editRow.id,
            label: label.trim(),
            legacyKind: legacyKindForSubmit as Level | null,
          });
          if (!r.success) {
            setError(r.error);
            setLoading(false);
            return;
          }
        }
      } else {
        if (mode === "create") {
          const r = await createTeamShift({
            teamId,
            label: label.trim(),
            legacyKind: legacyKindForSubmit as Shift | null,
            sortOrder: createSortOrder,
          });
          if (!r.success) {
            setError(r.error);
            setLoading(false);
            return;
          }
        } else if (editRow) {
          const r = await updateTeamShift({
            id: editRow.id,
            label: label.trim(),
            legacyKind: legacyKindForSubmit as Shift | null,
          });
          if (!r.success) {
            setError(r.error);
            setLoading(false);
            return;
          }
        }
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  const title =
    variant === "level"
      ? mode === "create"
        ? "Novo nível"
        : "Editar nível"
      : mode === "create"
        ? "Novo turno"
        : "Editar turno";

  const entityKind = variant === "level" ? "nível" : "turno";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cat-label">Nome</Label>
              <Input
                id="cat-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={
                  variant === "level"
                    ? "ex.: N1 Jr, Suporte Noturno"
                    : "ex.: Turno Manhã"
                }
                autoComplete="off"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-legacy-kind">Tipo do sistema</Label>
              <Select
                value={legacyKind}
                onValueChange={(v) => setLegacyKind(v)}
                disabled={loading}
              >
                <SelectTrigger id="cat-legacy-kind">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CUSTOM_LEGACY_KIND_VALUE}>
                    Personalizado (sem regra de escala)
                  </SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {legacyKindForSubmit
                  ? `Este ${entityKind} entra nas regras de escala/sobreaviso do tipo ${legacyKindForSubmit}. Só pode existir um ${entityKind} por tipo em cada equipe.`
                  : `${entityKind[0].toUpperCase()}${entityKind.slice(1)} personalizado: aparece no catálogo, mas fica fora das regras atuais de escala e do formulário de membros até que a parametrização seja implementada.`}
              </p>
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="cursor-pointer" disabled={loading}>
              {loading ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CatalogDeleteDialog({
  state,
  onOpenChange,
  onSuccess,
}: {
  state: DeleteState;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const open = state.open;
  const row = state.open ? state.row : null;
  const variant = state.open ? state.variant : "level";

  async function confirm() {
    if (!state.open || !row) return;
    setLoading(true);
    try {
      const r =
        variant === "level"
          ? await deleteTeamLevel(row.id)
          : await deleteTeamShift(row.id);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  if (!open || !row) return null;

  const kind = variant === "level" ? "nível" : "turno";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {kind}?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso remove &quot;{row.label}&quot; e os vínculos na matriz de compatibilidade. Os membros
            da equipe não são alterados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            className="cursor-pointer"
            disabled={loading}
            onClick={() => void confirm()}
          >
            {loading ? "Removendo…" : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
