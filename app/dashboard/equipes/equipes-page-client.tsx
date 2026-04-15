"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TeamListItem } from "@/server/team/getTeams";
import { createTeam } from "@/server/team/createTeam";
import { updateTeam } from "@/server/team/updateTeam";
import { deleteTeam } from "@/server/team/deleteTeam";

interface EquipesPageClientProps {
  teams: TeamListItem[];
}

export function EquipesPageClient({ teams: initialTeams }: EquipesPageClientProps) {
  const router = useRouter();
  const [teams, setTeams] = useState(initialTeams);

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function openAdd() {
    setDialogMode("add");
    setEditingId(null);
    setName("");
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(team: TeamListItem) {
    setDialogMode("edit");
    setEditingId(team.id);
    setName(team.name);
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    setSaving(true);
    try {
      if (dialogMode === "add") {
        const result = await createTeam({ name });
        if (result.success) {
          toast.success("Equipe criada.");
          setDialogOpen(false);
          refresh();
        } else {
          setFormError(result.error ?? null);
        }
      } else if (editingId) {
        const result = await updateTeam({ id: editingId, name });
        if (result.success) {
          toast.success("Equipe atualizada.");
          setDialogOpen(false);
          refresh();
        } else {
          setFormError(result.error ?? null);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleteLoading(true);
    const result = await deleteTeam({ id: deleteId });
    setDeleteLoading(false);
    if (result.success) {
      toast.success("Equipe removida.");
      setDeleteId(null);
      refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Equipes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre e edite os nomes dos times. A equipe padrão é usada quando nenhuma outra está
            selecionada no topo.
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="mt-4 sm:mt-0 bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova equipe
        </Button>
      </div>

      <Card className="rounded-xl border border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-lg font-bold text-foreground">Times</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Lista de todas as equipes do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {teams.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma equipe cadastrada.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {teams.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate font-medium text-foreground">{t.name}</span>
                    {t.isDefault ? (
                      <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Padrão
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 cursor-pointer"
                      aria-label={`Editar ${t.name}`}
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 cursor-pointer text-destructive hover:text-destructive"
                      aria-label={`Remover ${t.name}`}
                      onClick={() => setDeleteId(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setFormError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === "add" ? "Nova equipe" : "Editar equipe"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="equipe-nome">Nome</Label>
            <Input
              id="equipe-nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Equipe A"
              className="h-11"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
              }}
            />
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !name.trim()}
              className="cursor-pointer"
            >
              {saving ? "Salvando…" : dialogMode === "add" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Só é possível excluir equipes sem membros e sem
              escalas vinculadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
