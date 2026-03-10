"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const PHONE_DIGITS = 11; // e.g. 5511999999999

export interface PhoneOtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  /** Placeholder pattern for empty boxes, e.g. "11999999999". Length should match `length`. */
  placeholder?: string;
}

export function PhoneOtpInput({
  value,
  onChange,
  length = PHONE_DIGITS,
  disabled = false,
  className,
  "aria-label": ariaLabel = "Número de telefone",
  placeholder: placeholderPattern = "11999999999",
}: PhoneOtpInputProps) {
  const digits = value.replace(/\D/g, "").slice(0, length).split("");
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const placeholderChars = placeholderPattern.replace(/\D/g, "").slice(0, length).split("");
  const placeholderChar = (i: number) => placeholderChars[i] ?? "";

  const setValueFromDigits = React.useCallback(
    (newDigits: string[]) => {
      const str = newDigits.join("");
      onChange(str);
    },
    [onChange]
  );

  const focusIndex = (index: number) => {
    const i = Math.max(0, Math.min(index, length - 1));
    inputRefs.current[i]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits.splice(index - 1, 1);
      setValueFromDigits(newDigits);
      focusIndex(index - 1);
      e.preventDefault();
    } else if (e.key === "Backspace" && digits[index]) {
      const newDigits = [...digits];
      newDigits.splice(index, 1);
      setValueFromDigits(newDigits);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusIndex(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusIndex(index + 1);
    }
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw.length > 1) {
      const pasted = (value.replace(/\D/g, "") + raw).slice(0, length).split("");
      setValueFromDigits(pasted);
      focusIndex(Math.min(index + raw.length, length - 1));
      return;
    }
    const char = raw[0];
    if (!char) {
      const newDigits = [...digits];
      newDigits.splice(index, 1);
      setValueFromDigits(newDigits);
      return;
    }
    const newDigits = [...digits];
    newDigits[index] = char;
    if (index < length - 1) {
      setValueFromDigits(newDigits);
      focusIndex(index + 1);
    } else {
      setValueFromDigits(newDigits);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length)
      .split("");
    setValueFromDigits(pasted);
    focusIndex(pasted.length);
  };

  // Formato BR: (DD) XXXXX-XXXX → ( após 0, ) após 1, - após 6
  const sepBefore = (i: number) => i === 0 ? "(" : null;
  const sepAfter = (i: number) => i === 1 ? ")" : i === 6 ? "-" : null;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-nowrap items-center justify-center gap-0.5 overflow-hidden", className)}
    >
      {Array.from({ length }, (_, i) => (
        <React.Fragment key={i}>
          {sepBefore(i) && (
            <span className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums" aria-hidden>
              {sepBefore(i)}
            </span>
          )}
          <input
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={i === 0 ? length : 1}
            value={digits[i] ?? ""}
            placeholder={placeholderChar(i)}
            disabled={disabled}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onChange={(e) => handleChange(i, e)}
            onPaste={handlePaste}
            aria-label={`Dígito ${i + 1} de ${length}`}
            className={cn(
              "h-10 w-8 shrink-0 rounded-lg border border-input bg-transparent text-center text-sm font-medium tabular-nums transition-colors outline-none",
              "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
              "disabled:pointer-events-none disabled:opacity-50 disabled:bg-input/50",
              "placeholder:text-muted-foreground/60",
              "aria-invalid:border-destructive aria-invalid:ring-destructive/20"
            )}
          />
          {sepAfter(i) && (
            <span className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums" aria-hidden>
              {sepAfter(i)}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
