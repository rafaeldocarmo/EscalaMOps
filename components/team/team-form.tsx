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

const LEVEL_VALUES: Level[] = ["N1", "N2"];
const SHIFT_VALUES: Shift[] = ["T1", "T2", "T3"];

export interface TeamFormValues {
  name: string;
  phone: string;
  level: Level;
  shift: Shift;
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
  if (shift === "T3" && level === "N2")
    return "Turno T3 aceita apenas nível N1.";
  return null;
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
  const [levelShiftError, setLevelShiftError] = useState<string | null>(null);

  const handleLevelChange = useCallback(
    (value: Level) => {
      setLevel(value);
      setLevelShiftError(validateLevelShift(value, shift));
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
    await onSubmit({ name: name.trim(), phone: phone.trim(), level, shift });
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
