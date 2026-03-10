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
import type { TeamMemberRow } from "@/types/team";
import { TeamModal } from "./team-modal";
import type { TeamFormValues } from "./team-form";
import { sortTeamMembers } from "@/lib/sortTeamMembers";
import { formatMemberName } from "@/lib/formatMemberName";

interface TeamTableProps {
  members: TeamMemberRow[];
  onEdit: (id: string, values: TeamFormValues) => Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }>;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
  onSuccess?: () => void;
}

export function TeamTable({
  members,
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
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead className="w-[120px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum membro cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              sortedMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{formatMemberName(member.name)}</TableCell>
                  <TableCell>{member.phone}</TableCell>
                  <TableCell>{member.level}</TableCell>
                  <TableCell>{member.shift}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditId(member.id)}
                        aria-label="Editar"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(member.id)}
                        aria-label="Excluir"
                      >
                        <Trash2Icon className="size-4" />
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
        defaultValues={
          memberToEdit
            ? {
                name: memberToEdit.name,
                phone: memberToEdit.phone,
                level: memberToEdit.level,
                shift: memberToEdit.shift,
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
