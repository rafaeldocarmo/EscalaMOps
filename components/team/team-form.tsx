"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
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
import type { Level, Shift } from "@/types/team";
import { displayLabelForLevel, displayLabelForShift } from "@/types/team";
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
  level: Level;
  shift: Shift;
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
  level: Level,
  shift: Shift,
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
  if (!isPairAllowedInCatalog(memberCatalog, level, shift)) {
    return "Esta combinação de nível e turno não é permitida para a equipe. Ajuste a matriz em Níveis e turnos.";
  }
  return null;
}

function canSobreaviso(level: Level): boolean {
  return level === "N2" || level === "ESPC" || level === "PRODUCAO";
}

function forceSobreaviso(level: Level): boolean {
  return level === "PRODUCAO";
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
  const isEdit = defaultValues?.level != null && defaultValues?.shift != null;
  const isEditWithoutCatalog = isEdit && !memberCatalog;

  const [name, setName] = useState(defaultValues?.name ?? "");
  const [phone, setPhone] = useState(() =>
    defaultValues?.phone ? formatPhone(defaultValues.phone) : "",
  );
  const [level, setLevel] = useState<Level>(() => {
    if (defaultValues?.level) return defaultValues.level;
    if (memberCatalog?.levels[0]) return memberCatalog.levels[0];
    return "N1";
  });
  const [shift, setShift] = useState<Shift>(() => {
    if (defaultValues?.level != null && defaultValues?.shift != null) return defaultValues.shift;
    const L = memberCatalog?.levels[0] ?? "N1";
    if (memberCatalog) {
      const allowed = shiftsAllowedForLevel(memberCatalog, L);
      return allowed[0] ?? memberCatalog.orderedShifts[0] ?? "T1";
    }
    return "T1";
  });
  const [sobreaviso, setSobreaviso] = useState(defaultValues?.sobreaviso ?? false);
  const [participatesInSchedule, setParticipatesInSchedule] = useState(
    defaultValues?.participatesInSchedule ?? true,
  );
  const [levelShiftError, setLevelShiftError] = useState<string | null>(null);

  const handleLevelChange = useCallback(
    (value: Level) => {
      setLevel(value);
      if (!memberCatalog) {
        setLevelShiftError(
          isEditWithoutCatalog ? null : "Cadastre níveis e turnos em Configurações antes de alterar.",
        );
        return;
      }
      const opts = shiftsAllowedForLevel(memberCatalog, value);
      let nextShift: Shift;
      if (opts.includes(shift)) nextShift = shift;
      else if (opts.length > 0) nextShift = opts[0];
      else nextShift = memberCatalog.orderedShifts[0] ?? "T1";
      setShift(nextShift);
      setLevelShiftError(validateCombo(value, nextShift, memberCatalog, false));
      if (forceSobreaviso(value)) {
        setSobreaviso(true);
      } else if (!canSobreaviso(value)) {
        setSobreaviso(false);
      }
    },
    [shift, memberCatalog, isEditWithoutCatalog],
  );

  const handleShiftChange = useCallback(
    (value: Shift) => {
      setShift(value);
      setLevelShiftError(validateCombo(level, value, memberCatalog, isEditWithoutCatalog));
    },
    [level, memberCatalog, isEditWithoutCatalog],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLevelShiftError(null);
    if (!isEdit && !memberCatalog) {
      setLevelShiftError("Cadastre níveis e turnos da equipe em Configurações antes de adicionar membros.");
      return;
    }
    const err = validateCombo(level, shift, memberCatalog, isEditWithoutCatalog);
    if (err) {
      setLevelShiftError(err);
      return;
    }
    await onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      level,
      shift,
      sobreaviso: forceSobreaviso(level) ? true : canSobreaviso(level) ? sobreaviso : false,
      participatesInSchedule,
    });
  }

  const nameError = externalFieldErrors.name?.[0];
  const phoneError = externalFieldErrors.phone?.[0];
  const levelError = externalFieldErrors.level?.[0];
  const shiftError = externalFieldErrors.shift?.[0];

  const levelChoices: Level[] = (() => {
    if (!memberCatalog) return isEdit && defaultValues?.level ? [defaultValues.level] : [];
    const list = [...memberCatalog.levels];
    if (defaultValues?.level && !list.includes(defaultValues.level)) {
      list.push(defaultValues.level);
    }
    return list;
  })();

  const shiftChoices: Shift[] = (() => {
    if (!memberCatalog) return isEdit && defaultValues?.shift ? [defaultValues.shift] : [];
    let list = shiftsAllowedForLevel(memberCatalog, level);
    if (defaultValues?.level === level && defaultValues.shift && !list.includes(defaultValues.shift)) {
      list = [defaultValues.shift, ...list];
    }
    if (list.length === 0) {
      list = [...memberCatalog.orderedShifts];
    }
    return list;
  })();

  const levelOptionsForSelect = levelChoices.map((v) => ({
    value: v,
    label: memberCatalog?.levelLabels[v] ?? displayLabelForLevel(v),
  }));
  const shiftOptionsForSelect = shiftChoices.map((v) => ({
    value: v,
    label: memberCatalog?.shiftLabels[v] ?? displayLabelForShift(v),
  }));

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
          <p className="mt-2 text-foreground">
            <span className="text-muted-foreground">Nível:</span> {displayLabelForLevel(level)}
            {" · "}
            <span className="text-muted-foreground">Turno:</span> {displayLabelForShift(shift)}
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
              value={level}
              onValueChange={(v) => handleLevelChange(v as Level)}
              disabled={loading || !memberCatalog}
            >
              <SelectTrigger id="team-level" className="w-full" aria-invalid={!!levelError}>
                <SelectValue placeholder="Selecione o nível" />
              </SelectTrigger>
              <SelectContent>
                {levelOptionsForSelect.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
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
              value={shift}
              onValueChange={(v) => handleShiftChange(v as Shift)}
              disabled={loading || !memberCatalog}
            >
              <SelectTrigger id="team-shift" className="w-full" aria-invalid={!!shiftError}>
                <SelectValue placeholder="Selecione o turno" />
              </SelectTrigger>
              <SelectContent>
                {shiftOptionsForSelect.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
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

      {canSobreaviso(level) && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={sobreaviso}
            disabled={loading || forceSobreaviso(level)}
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
          <Label className="cursor-pointer" onClick={() => !loading && !forceSobreaviso(level) && setSobreaviso((v) => !v)}>
            Participa do Sobreaviso{forceSobreaviso(level) ? " (obrigatório)" : ""}
          </Label>
        </div>
      )}

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
