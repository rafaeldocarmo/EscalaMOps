"use client";

import { useState } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { MemberFormCatalog } from "@/lib/memberFormCatalog";
import type { TeamMemberRow } from "@/types/team";
import { TeamModal } from "./team-modal";
import type { TeamFormValues } from "./team-form";
import { sortTeamMembers } from "@/lib/sortTeamMembers";
import { formatMemberName } from "@/lib/formatMemberName";

interface TeamTableProps {
  members: TeamMemberRow[];
  memberCatalog?: MemberFormCatalog | null;
  onEdit: (id: string, values: TeamFormValues) => Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }>;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  onSuccess?: () => void;
}

export function TeamTable({
  members,
  memberCatalog,
  onEdit,
  onDelete,
  onSuccess,
}: TeamTableProps) {
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const sortedMembers = sortTeamMembers(members);
  const memberToEdit = editId ? members.find((m) => m.id === editId) : null;

  async function handleEditSubmit(values: TeamFormValues) {
    if (!editId) return;
    setError(null);
    setFieldErrors({});
    setLoading(true);
    const result = await onEdit(editId, values);
    setLoading(false);
    if (result.success) {
      onSuccess?.();
      setEditId(null);
    } else {
      setError(result.error ?? null);
      setFieldErrors(result.fieldErrors ?? {});
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    setLoading(true);
    const result = await onDelete(deleteId);
    setLoading(false);
    if (result.success) {
      onSuccess?.();
      setDeleteId(null);
    } else {
      setError(result.error ?? null);
    }
  }

  return (
    <>
      <div className="w-full overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/50 bg-muted/50 hover:bg-muted/50">
              <TableHead className="h-11 px-4 font-semibold text-foreground">Nome</TableHead>
              <TableHead className="px-4 font-semibold text-foreground">Telefone</TableHead>
              <TableHead className="px-4 font-semibold text-foreground">Nivel</TableHead>
              <TableHead className="px-4 font-semibold text-foreground">Turno</TableHead>
              <TableHead className="px-4 font-semibold text-foreground">Sobreaviso</TableHead>
              <TableHead className="px-4 font-semibold text-foreground">Escala</TableHead>
              <TableHead className="w-[120px] px-4 text-right font-semibold text-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 px-4 text-center text-muted-foreground">
                  Nenhum membro cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              sortedMembers.map((member, index) => (
                <TableRow
                  key={member.id}
                  className={index % 2 === 1 ? "bg-muted/30" : ""}
                >
                  <TableCell className="px-4 font-medium text-foreground">
                    {formatMemberName(member.name)}
                  </TableCell>
                  <TableCell className="px-4 text-foreground">{member.phone}</TableCell>
                  <TableCell className="px-4">
                    <span
                      className={
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium " +
                        (member.levelLegacyKind == null
                          ? "border-purple-500/40 bg-purple-500/15 text-purple-700"
                          : "border-green-500/40 bg-green-500/15 text-green-700")
                      }
                      title={member.levelLegacyKind == null ? "Personalizado (fora das regras legadas)" : undefined}
                    >
                      {member.levelLabel}
                    </span>
                  </TableCell>
                  <TableCell className="px-4">
                    <span
                      className={
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium " +
                        (member.shiftLegacyKind == null
                          ? "border-purple-500/40 bg-purple-500/15 text-purple-700"
                          : "border-amber-500/40 bg-amber-500/15 text-amber-700")
                      }
                      title={member.shiftLegacyKind == null ? "Personalizado (fora das regras legadas)" : undefined}
                    >
                      {member.shiftLabel}
                    </span>
                  </TableCell>
                  <TableCell className="px-4">
                    {member.sobreaviso ? (
                      <span className="inline-flex items-center rounded-md border border-blue-500/40 bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Sim
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    {member.participatesInSchedule ? (
                      <span className="text-xs text-muted-foreground">Sim</span>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-muted bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Fora da escala
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="group border border-transparent hover:border-red-500 hover:bg-red-500/10 hover:text-red-600 cursor-pointer"
                        onClick={() => setEditId(member.id)}
                        aria-label="Editar"
                      >
                        <PencilIcon className="size-4 group-hover:text-red-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="group border border-transparent text-red-600/80 hover:border-red-500 hover:bg-red-500/10 hover:text-red-600 cursor-pointer"
                        onClick={() => setDeleteId(member.id)}
                        aria-label="Excluir"
                      >
                        <Trash2Icon className="size-4 group-hover:text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TeamModal
        key={editId ?? "add"}
        open={!!editId}
        onOpenChange={(open) => {
          if (!open) setEditId(null);
          setError(null);
          setFieldErrors({});
        }}
        title="Editar membro"
        memberCatalog={memberCatalog}
        defaultValues={
          memberToEdit
            ? {
                name: memberToEdit.name,
                phone: memberToEdit.phone,
                teamLevelId: memberToEdit.teamLevelId,
                teamShiftId: memberToEdit.teamShiftId,
                sobreaviso: memberToEdit.sobreaviso,
                participatesInSchedule: memberToEdit.participatesInSchedule,
              }
            : undefined
        }
        onSubmit={handleEditSubmit}
        loading={loading}
        submitLabel="Salvar"
        error={error}
        fieldErrors={fieldErrors}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este membro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={loading}
            >
              {loading ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
