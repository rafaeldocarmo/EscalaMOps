"use client";

import { useState, useCallback, useMemo } from "react";
import type { MemberFormCatalog } from "@/lib/memberFormCatalog";
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
import { Input } from "@/components/ui/input";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import type { TeamListItem } from "@/server/team/getTeams";

interface TeamPageClientProps {
  initialMembers: TeamMemberRow[];
  teams: TeamListItem[];
  /** Catálogo da equipe atual para restritir nível/turno no formulário (M5). */
  memberFormCatalog: MemberFormCatalog | null;
}

type SobreavisoFilter = "with" | "without";

const SOBREAVISO_OPTIONS: MultiSelectOption<SobreavisoFilter>[] = [
  { value: "with", label: "Com sobreaviso" },
  { value: "without", label: "Sem sobreaviso" },
];

export function TeamPageClient({ initialMembers, memberFormCatalog }: TeamPageClientProps) {
  const router = useRouter();
  const [addFormKey, setAddFormKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addFieldErrors, setAddFieldErrors] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [selectedSobreaviso, setSelectedSobreaviso] = useState<SobreavisoFilter[]>([]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const levelFilterOptions = useMemo<MultiSelectOption<string>[]>(() => {
    if (!memberFormCatalog) return [];
    return memberFormCatalog.levels.map((l) => ({
      value: l.id,
      label: l.legacyKind == null ? `${l.label} (personalizado)` : l.label,
    }));
  }, [memberFormCatalog]);

  const shiftFilterOptions = useMemo<MultiSelectOption<string>[]>(() => {
    if (!memberFormCatalog) return [];
    return memberFormCatalog.shifts.map((s) => ({
      value: s.id,
      label: s.legacyKind == null ? `${s.label} (personalizado)` : s.label,
    }));
  }, [memberFormCatalog]);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return initialMembers.filter((member) => {
      if (term) {
        const nameMatch = member.name.toLowerCase().includes(term);
        const phoneDigits = member.phone.replace(/\D/g, "");
        const termDigits = term.replace(/\D/g, "");
        const phoneMatch = termDigits.length > 0 ? phoneDigits.includes(termDigits) : false;

        if (!nameMatch && !phoneMatch) {
          return false;
        }
      }

      if (selectedLevelIds.length > 0 && !selectedLevelIds.includes(member.teamLevelId)) {
        return false;
      }

      if (selectedShiftIds.length > 0 && !selectedShiftIds.includes(member.teamShiftId)) {
        return false;
      }

      if (selectedSobreaviso.length > 0) {
        const wantsWith = selectedSobreaviso.includes("with");
        const wantsWithout = selectedSobreaviso.includes("without");

        if (!(wantsWith && wantsWithout)) {
          if (wantsWith && !member.sobreaviso) return false;
          if (wantsWithout && member.sobreaviso) return false;
        }
      }

      return true;
    });
  }, [initialMembers, search, selectedLevelIds, selectedShiftIds, selectedSobreaviso]);

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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Membros</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os membros da equipe selecionada no topo. Nível e turno seguem o catálogo e a matriz em
            Configurações → Níveis e turnos.
            {!memberFormCatalog ? (
              <span className="block text-amber-700 dark:text-amber-500">
                Cadastre níveis e turnos nesta equipe para poder adicionar membros e usar os filtros por nível/turno.
              </span>
            ) : null}
          </p>
        </div>
        <Button
          onClick={() => {
            setAddFormKey((k) => k + 1);
            setAddOpen(true);
          }}
          disabled={!memberFormCatalog}
          title={
            !memberFormCatalog
              ? "Cadastre níveis e turnos da equipe em Configurações antes de adicionar membros."
              : undefined
          }
          className="mt-4 sm:mt-0 bg-foreground text-background hover:bg-foreground/90 cursor-pointer disabled:opacity-50"
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
          <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 lg:flex-row lg:items-center">
            <Input
              placeholder="Filtrar por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full lg:flex-1"
            />
            <div className="flex flex-wrap gap-2 lg:shrink-0">
              <MultiSelect
                label="Nível"
                options={levelFilterOptions}
                value={selectedLevelIds}
                onChange={setSelectedLevelIds}
                size="default"
                buttonClassName="h-11"
              />
              <MultiSelect
                label="Turno"
                options={shiftFilterOptions}
                value={selectedShiftIds}
                onChange={setSelectedShiftIds}
                size="default"
                buttonClassName="h-11"
              />
              <MultiSelect
                label="Sobreaviso"
                options={SOBREAVISO_OPTIONS}
                value={selectedSobreaviso}
                onChange={setSelectedSobreaviso}
                size="default"
                buttonClassName="h-11"
              />
            </div>
          </div>
          <TeamTable
            members={filteredMembers}
            memberCatalog={memberFormCatalog}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSuccess={refresh}
          />
        </CardContent>
      </Card>

      <TeamModal
        key={`add-${addFormKey}`}
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Adicionar membro"
        memberCatalog={memberFormCatalog}
        onSubmit={handleCreate}
        loading={addLoading}
        submitLabel="Adicionar"
        error={addError}
        fieldErrors={addFieldErrors}
      />
    </div>
  );
}
