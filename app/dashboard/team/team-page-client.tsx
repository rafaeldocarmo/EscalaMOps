"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TeamModal } from "@/components/team/team-modal";
import { TeamTable } from "@/components/team/team-table";
import type { TeamFormValues } from "@/components/team/team-form";
import type { TeamMemberRow } from "@/types/team";
import { createTeamMember } from "@/server/team/createTeamMember";
import { updateTeamMember } from "@/server/team/updateTeamMember";
import { deleteTeamMember } from "@/server/team/deleteTeamMember";

interface TeamPageClientProps {
  initialMembers: TeamMemberRow[];
}

export function TeamPageClient({ initialMembers }: TeamPageClientProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addFieldErrors, setAddFieldErrors] = useState<Record<string, string[]>>({});

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  async function handleCreate(values: TeamFormValues) {
    setAddError(null);
    setAddFieldErrors({});
    setAddLoading(true);
    const result = await createTeamMember(values);
    setAddLoading(false);
    if (result.success) {
      toast.success("Membro adicionado com sucesso.");
      setAddOpen(false);
      refresh();
    } else {
      setAddError(result.error ?? null);
      setAddFieldErrors(result.fieldErrors ?? {});
    }
  }

  async function handleEdit(
    id: string,
    values: TeamFormValues
  ): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }> {
    const result = await updateTeamMember(id, values);
    if (result.success) {
      toast.success("Membro atualizado com sucesso.");
      refresh();
    }
    return {
      success: result.success,
      error: "error" in result ? result.error : undefined,
      fieldErrors: "fieldErrors" in result ? result.fieldErrors : undefined,
    };
  }

  async function handleDelete(
    id: string
  ): Promise<{ success: boolean; error?: string }> {
    const result = await deleteTeamMember(id);
    if (result.success) {
      toast.success("Membro removido com sucesso.");
      refresh();
    }
    return {
      success: result.success,
      error: "error" in result ? result.error : undefined,
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Visão do Time
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os membros da equipe, níveis e turnos.
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="mt-4 sm:mt-0 bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
        >
          Adicionar Membro
        </Button>
      </div>

      <Card className="rounded-xl border border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-lg font-bold text-foreground">Membros</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Lista de membros com nome, telefone, nível e turno.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <TeamTable
            members={initialMembers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSuccess={refresh}
          />
        </CardContent>
      </Card>

      <TeamModal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Adicionar membro"
        onSubmit={handleCreate}
        loading={addLoading}
        submitLabel="Adicionar"
        error={addError}
        fieldErrors={addFieldErrors}
      />
    </div>
  );
}
