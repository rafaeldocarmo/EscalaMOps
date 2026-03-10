"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TeamForm, type TeamFormValues } from "./team-form";

interface TeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  defaultValues?: Partial<TeamFormValues>;
  onSubmit: (values: TeamFormValues) => Promise<void>;
  loading?: boolean;
  submitLabel?: string;
  error?: string | null;
  fieldErrors?: Record<string, string[]>;
}

export function TeamModal({
  open,
  onOpenChange,
  title,
  defaultValues,
  onSubmit,
  loading,
  submitLabel,
  error,
  fieldErrors,
}: TeamModalProps) {
  async function handleSubmit(values: TeamFormValues) {
    await onSubmit(values);
    // Parent controls closing (e.g. on success or after create)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <TeamForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          loading={loading}
          submitLabel={submitLabel}
          error={error}
          fieldErrors={fieldErrors}
        />
      </DialogContent>
    </Dialog>
  );
}
