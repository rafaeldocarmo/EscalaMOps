"use client";

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
import { LEVEL_OPTIONS, SHIFT_OPTIONS } from "@/types/team";
import { formatPhone, PHONE_MASK_MAX_LENGTH } from "@/lib/formatPhone";

export interface TeamFormValues {
  name: string;
  phone: string;
  level: Level;
  shift: Shift;
  sobreaviso: boolean;
}

interface TeamFormProps {
  defaultValues?: Partial<TeamFormValues>;
  onSubmit: (values: TeamFormValues) => Promise<void>;
  loading?: boolean;
  submitLabel?: string;
  error?: string | null;
  fieldErrors?: Record<string, string[]>;
}

function validateLevelShift(level: Level, shift: Shift): string | null {
  if (level === "N2" && shift === "T3")
    return "N2 só pode estar nos turnos T1 ou T2.";
  if (shift === "T3" && (level === "ESPC" || level === "PRODUCAO"))
    return "Turno T3 não aceita esse nível.";
  if (level === "ESPC" && shift !== "TC")
    return "ESPC deve usar turno TC.";
  if (level === "PRODUCAO" && shift !== "TC")
    return "Produção deve usar turno TC.";
  if (shift === "TC" && level !== "ESPC" && level !== "PRODUCAO")
    return "Turno TC é exclusivo dos níveis ESPC e Produção.";
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
  onSubmit,
  loading = false,
  submitLabel = "Salvar",
  error: externalError,
  fieldErrors: externalFieldErrors = {},
}: TeamFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [phone, setPhone] = useState(() =>
    defaultValues?.phone ? formatPhone(defaultValues.phone) : ""
  );
  const [level, setLevel] = useState<Level>(defaultValues?.level ?? "N1");
  const [shift, setShift] = useState<Shift>(defaultValues?.shift ?? "T1");
  const [sobreaviso, setSobreaviso] = useState(defaultValues?.sobreaviso ?? false);
  const [levelShiftError, setLevelShiftError] = useState<string | null>(null);

  const handleLevelChange = useCallback(
    (value: Level) => {
      setLevel(value);
      const autoShift = (value === "ESPC" || value === "PRODUCAO") ? "TC" : shift === "TC" ? "T1" : shift;
      setShift(autoShift);
      setLevelShiftError(validateLevelShift(value, autoShift));
      if (forceSobreaviso(value)) {
        setSobreaviso(true);
      } else if (!canSobreaviso(value)) {
        setSobreaviso(false);
      }
    },
    [shift]
  );

  const handleShiftChange = useCallback(
    (value: Shift) => {
      setShift(value);
      setLevelShiftError(validateLevelShift(level, value));
    },
    [level]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLevelShiftError(null);
    const err = validateLevelShift(level, shift);
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
    });
  }

  const nameError = externalFieldErrors.name?.[0];
  const phoneError = externalFieldErrors.phone?.[0];
  const levelError = externalFieldErrors.level?.[0];
  const shiftError = externalFieldErrors.shift?.[0];

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
      <div className="space-y-2">
        <Label>Nível</Label>
        <Select
          value={level}
          onValueChange={(v) => handleLevelChange(v as Level)}
          disabled={loading}
        >
          <SelectTrigger id="team-level" className="w-full" aria-invalid={!!levelError}>
            <SelectValue placeholder="Selecione o nível" />
          </SelectTrigger>
          <SelectContent>
            {LEVEL_OPTIONS.map((opt) => (
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
          disabled={loading}
        >
          <SelectTrigger id="team-shift" className="w-full" aria-invalid={!!shiftError}>
            <SelectValue placeholder="Selecione o turno" />
          </SelectTrigger>
          <SelectContent>
            {SHIFT_OPTIONS.map((opt) => (
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
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}
