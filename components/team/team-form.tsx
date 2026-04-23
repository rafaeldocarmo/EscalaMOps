"use client";

import Link from "next/link";
import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPhone, PHONE_MASK_MAX_LENGTH } from "@/lib/formatPhone";
import {
  type MemberFormCatalog,
  isPairAllowedInCatalog,
  shiftsAllowedForLevel,
} from "@/lib/memberFormCatalog";

const CATALOG_SETTINGS_PATH = "/dashboard/equipes/catalog";

export interface TeamFormValues {
  name: string;
  phone: string;
  teamLevelId: string;
  teamShiftId: string;
  sobreaviso: boolean;
  participatesInSchedule: boolean;
}

interface TeamFormProps {
  defaultValues?: Partial<TeamFormValues>;
  /** Catálogo da equipe (níveis, turnos e matriz). Obrigatório para incluir novo membro. */
  memberCatalog?: MemberFormCatalog | null;
  onSubmit: (values: TeamFormValues) => Promise<void>;
  loading?: boolean;
  submitLabel?: string;
  error?: string | null;
  fieldErrors?: Record<string, string[]>;
}

function validateCombo(
  teamLevelId: string,
  teamShiftId: string,
  memberCatalog: MemberFormCatalog | null | undefined,
  isEditWithoutCatalog: boolean,
): string | null {
  if (isEditWithoutCatalog) return null;
  if (!memberCatalog) {
    return "Cadastre níveis e turnos da equipe em Configurações antes de definir nível e turno.";
  }
  if (memberCatalog.allowedPairKeys.size === 0) {
    return "Defina ao menos uma combinação na matriz de compatibilidade em Configurações → Níveis e turnos.";
  }
  if (!teamLevelId || !teamShiftId) {
    return "Selecione nível e turno.";
  }
  if (!isPairAllowedInCatalog(memberCatalog, teamLevelId, teamShiftId)) {
    return "Esta combinação de nível e turno não é permitida para a equipe. Ajuste a matriz em Níveis e turnos.";
  }
  return null;
}

function findLevel(memberCatalog: MemberFormCatalog | null | undefined, id: string) {
  return memberCatalog?.levels.find((l) => l.id === id) ?? null;
}

function findShift(memberCatalog: MemberFormCatalog | null | undefined, id: string) {
  return memberCatalog?.shifts.find((s) => s.id === id) ?? null;
}

export function TeamForm({
  defaultValues,
  memberCatalog,
  onSubmit,
  loading = false,
  submitLabel = "Salvar",
  error: externalError,
  fieldErrors: externalFieldErrors = {},
}: TeamFormProps) {
  const isEdit = defaultValues?.teamLevelId != null && defaultValues?.teamShiftId != null;
  const isEditWithoutCatalog = isEdit && !memberCatalog;

  const [name, setName] = useState(defaultValues?.name ?? "");
  const [phone, setPhone] = useState(() =>
    defaultValues?.phone ? formatPhone(defaultValues.phone) : "",
  );

  const initialLevelId = useMemo(() => {
    if (defaultValues?.teamLevelId) return defaultValues.teamLevelId;
    return memberCatalog?.levels[0]?.id ?? "";
  }, [defaultValues?.teamLevelId, memberCatalog]);

  const initialShiftId = useMemo(() => {
    if (defaultValues?.teamShiftId) return defaultValues.teamShiftId;
    if (!memberCatalog) return "";
    const firstLevel = memberCatalog.levels[0];
    if (!firstLevel) return memberCatalog.shifts[0]?.id ?? "";
    const allowed = shiftsAllowedForLevel(memberCatalog, firstLevel.id);
    return allowed[0]?.id ?? memberCatalog.shifts[0]?.id ?? "";
  }, [defaultValues?.teamShiftId, memberCatalog]);

  const [teamLevelId, setTeamLevelId] = useState<string>(initialLevelId);
  const [teamShiftId, setTeamShiftId] = useState<string>(initialShiftId);
  const [sobreaviso, setSobreaviso] = useState(defaultValues?.sobreaviso ?? false);
  const [participatesInSchedule, setParticipatesInSchedule] = useState(
    defaultValues?.participatesInSchedule ?? true,
  );
  const [levelShiftError, setLevelShiftError] = useState<string | null>(null);

  const selectedLevel = findLevel(memberCatalog, teamLevelId);
  const selectedShift = findShift(memberCatalog, teamShiftId);

  // Custom levels/shifts are still valid — no restriction on participatesInSchedule or sobreaviso.
  // The admin decides per member.
  void selectedLevel;
  void selectedShift;

  const handleLevelChange = useCallback(
    (value: string) => {
      setTeamLevelId(value);
      if (!memberCatalog) {
        setLevelShiftError(
          isEditWithoutCatalog ? null : "Cadastre níveis e turnos em Configurações antes de alterar.",
        );
        return;
      }
      const opts = shiftsAllowedForLevel(memberCatalog, value);
      let nextShiftId = teamShiftId;
      if (!opts.some((o) => o.id === teamShiftId)) {
        nextShiftId = opts[0]?.id ?? memberCatalog.shifts[0]?.id ?? "";
      }
      setTeamShiftId(nextShiftId);
      setLevelShiftError(validateCombo(value, nextShiftId, memberCatalog, false));
    },
    [teamShiftId, memberCatalog, isEditWithoutCatalog],
  );

  const handleShiftChange = useCallback(
    (value: string) => {
      setTeamShiftId(value);
      setLevelShiftError(validateCombo(teamLevelId, value, memberCatalog, isEditWithoutCatalog));
    },
    [teamLevelId, memberCatalog, isEditWithoutCatalog],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLevelShiftError(null);
    if (!isEdit && !memberCatalog) {
      setLevelShiftError("Cadastre níveis e turnos da equipe em Configurações antes de adicionar membros.");
      return;
    }
    const err = validateCombo(teamLevelId, teamShiftId, memberCatalog, isEditWithoutCatalog);
    if (err) {
      setLevelShiftError(err);
      return;
    }

    await onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      teamLevelId,
      teamShiftId,
      sobreaviso,
      participatesInSchedule,
    });
  }

  const nameError = externalFieldErrors.name?.[0];
  const phoneError = externalFieldErrors.phone?.[0];
  const levelError = externalFieldErrors.teamLevelId?.[0];
  const shiftError = externalFieldErrors.teamShiftId?.[0];

  const levelChoices = useMemo(() => {
    if (!memberCatalog) {
      if (isEdit && defaultValues?.teamLevelId) {
        return [
          {
            id: defaultValues.teamLevelId,
            label: "(catálogo indisponível)",
            legacyKind: null,
          },
        ];
      }
      return [];
    }
    const list = [...memberCatalog.levels];
    if (defaultValues?.teamLevelId && !list.some((l) => l.id === defaultValues.teamLevelId)) {
      list.push({
        id: defaultValues.teamLevelId,
        label: "(removido do catálogo)",
        legacyKind: null,
      });
    }
    return list;
  }, [memberCatalog, defaultValues?.teamLevelId, isEdit]);

  const shiftChoices = useMemo(() => {
    if (!memberCatalog) {
      if (isEdit && defaultValues?.teamShiftId) {
        return [
          {
            id: defaultValues.teamShiftId,
            label: "(catálogo indisponível)",
            legacyKind: null,
          },
        ];
      }
      return [];
    }
    let list = shiftsAllowedForLevel(memberCatalog, teamLevelId);
    if (
      defaultValues?.teamLevelId === teamLevelId &&
      defaultValues?.teamShiftId &&
      !list.some((s) => s.id === defaultValues.teamShiftId)
    ) {
      const existing = memberCatalog.shifts.find((s) => s.id === defaultValues.teamShiftId);
      if (existing) list = [existing, ...list];
    }
    if (list.length === 0) {
      list = [...memberCatalog.shifts];
    }
    return list;
  }, [memberCatalog, teamLevelId, defaultValues?.teamLevelId, defaultValues?.teamShiftId, isEdit]);

  const createBlocked = !isEdit && !memberCatalog;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="team-name">Nome</Label>
        <Input
          id="team-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome completo"
          disabled={loading}
          aria-invalid={!!nameError}
        />
        {nameError && (
          <p className="text-sm text-destructive" role="alert">
            {nameError}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="team-phone">Telefone</Label>
        <Input
          id="team-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="(11)99999-9999"
          maxLength={PHONE_MASK_MAX_LENGTH}
          disabled={loading}
          aria-invalid={!!phoneError}
        />
        {phoneError && (
          <p className="text-sm text-destructive" role="alert">
            {phoneError}
          </p>
        )}
      </div>

      {createBlocked ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
          <p className="font-medium">Configure níveis e turnos primeiro</p>
          <p className="mt-1 text-muted-foreground">
            É preciso cadastrar níveis e turnos da equipe e a matriz de compatibilidade antes de adicionar membros.
          </p>
          <Link
            href={CATALOG_SETTINGS_PATH}
            className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline"
          >
            Abrir Níveis e turnos
          </Link>
        </div>
      ) : null}

      {isEditWithoutCatalog ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium text-foreground">Nível e turno (somente leitura)</p>
          <p className="mt-1 text-muted-foreground">
            Cadastre o catálogo em Configurações para poder alterar nível e turno. Você pode editar nome e telefone.
          </p>
          <Link
            href={CATALOG_SETTINGS_PATH}
            className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Configurar Níveis e turnos
          </Link>
        </div>
      ) : null}

      {!createBlocked && !isEditWithoutCatalog && memberCatalog ? (
        <p className="text-xs text-muted-foreground">
          Opções alinhadas ao catálogo e à matriz em Configurações → Níveis e turnos.
        </p>
      ) : null}

      {!createBlocked && !isEditWithoutCatalog ? (
        <>
          <div className="space-y-2">
            <Label>Nível</Label>
            <Select
              value={teamLevelId}
              onValueChange={handleLevelChange}
              disabled={loading || !memberCatalog}
            >
              <SelectTrigger id="team-level" className="w-full" aria-invalid={!!levelError}>
                <SelectValue placeholder="Selecione o nível" />
              </SelectTrigger>
              <SelectContent>
                {levelChoices.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {levelError && (
              <p className="text-sm text-destructive" role="alert">
                {levelError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Turno</Label>
            <Select
              value={teamShiftId}
              onValueChange={handleShiftChange}
              disabled={loading || !memberCatalog}
            >
              <SelectTrigger id="team-shift" className="w-full" aria-invalid={!!shiftError}>
                <SelectValue placeholder="Selecione o turno" />
              </SelectTrigger>
              <SelectContent>
                {shiftChoices.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(shiftError || levelShiftError) && (
              <p className="text-sm text-destructive" role="alert">
                {shiftError ?? levelShiftError}
              </p>
            )}
          </div>
        </>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={participatesInSchedule}
          disabled={loading}
          onClick={() => setParticipatesInSchedule((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            participatesInSchedule ? "bg-primary" : "bg-input"
          }`}
        >
          <span
            className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
              participatesInSchedule ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <Label className="cursor-pointer" onClick={() => !loading && setParticipatesInSchedule((v) => !v)}>
          Participa da rotação da escala
        </Label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={sobreaviso}
          disabled={loading}
          onClick={() => setSobreaviso((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            sobreaviso ? "bg-primary" : "bg-input"
          }`}
        >
          <span
            className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
              sobreaviso ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <Label className="cursor-pointer" onClick={() => !loading && setSobreaviso((v) => !v)}>
          Participa do Sobreaviso
        </Label>
      </div>

      {externalError && (
        <p className="text-sm text-destructive" role="alert">
          {externalError}
        </p>
      )}
      <Button type="submit" disabled={loading || createBlocked} className="w-full">
        {loading ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}
