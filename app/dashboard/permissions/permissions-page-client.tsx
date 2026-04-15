"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PermissionUserRow } from "@/server/permissions/getUsersForPermissions";
import type { TeamListItem } from "@/server/team/getTeams";
import type { SearchableUserRow } from "@/server/permissions/searchUsersForPermissionGrant";
import { updateUserRole } from "@/server/permissions/updateUserRole";
import { searchUsersForPermissionGrant } from "@/server/permissions/searchUsersForPermissionGrant";
import { cn } from "@/lib/utils";

const STAFF_ROLE_OPTIONS = [
  {
    value: "ADMIN",
    label: "Administrador",
    hint: "Acesso total ao sistema.",
  },
  {
    value: "ADMIN_TEAM",
    label: "Administrador de equipe",
    hint: "Só a equipe escolhida.",
  },
] as const;

interface Props {
  initialUsers: PermissionUserRow[];
  teams: TeamListItem[];
  currentUserId: string;
}

export function PermissionsPageClient({ initialUsers, teams, currentUserId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [users, setUsers] = useState(initialUsers);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userHits, setUserHits] = useState<SearchableUserRow[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [pickedUser, setPickedUser] = useState<SearchableUserRow | null>(null);
  const [newRole, setNewRole] = useState<"ADMIN" | "ADMIN_TEAM">("ADMIN");
  const [newTeamId, setNewTeamId] = useState<string>("");
  const [teamSearch, setTeamSearch] = useState("");

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);

  const filteredTeams = useMemo(() => {
    const t = teamSearch.trim().toLowerCase();
    if (!t) return teams;
    return teams.filter((x) => x.name.toLowerCase().includes(t));
  }, [teams, teamSearch]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!dialogOpen) return;
    const q = userQuery.trim();
    if (q.length < 2) {
      setUserHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      setUserLoading(true);
      void (async () => {
        try {
          const rows = await searchUsersForPermissionGrant(q);
          if (!cancelled) setUserHits(rows);
        } catch {
          if (!cancelled) {
            toast.error("Não foi possível buscar usuários.");
            setUserHits([]);
          }
        } finally {
          if (!cancelled) setUserLoading(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [userQuery, dialogOpen]);

  function openDialog() {
    setUserQuery("");
    setUserHits([]);
    setPickedUser(null);
    setNewRole("ADMIN");
    setNewTeamId(teams[0]?.id ?? "");
    setTeamSearch("");
    setDialogOpen(true);
  }

  useEffect(() => {
    if (newRole === "ADMIN_TEAM" && teams.length > 0 && !newTeamId) {
      setNewTeamId(teams[0]!.id);
    }
  }, [newRole, newTeamId, teams]);

  function resetDialog() {
    setUserQuery("");
    setUserHits([]);
    setPickedUser(null);
    setTeamSearch("");
  }

  function applyLocal(
    userId: string,
    role: string,
    managedTeamId: string | null,
    fallback?: Pick<PermissionUserRow, "name" | "email"> | null
  ) {
    if (role === "USER") {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      return;
    }
    setUsers((prev) => {
      const existing = prev.find((u) => u.id === userId);
      const row: PermissionUserRow = {
        id: userId,
        name: existing?.name ?? fallback?.name ?? null,
        email: existing?.email ?? fallback?.email ?? null,
        role,
        managedTeamId,
        isGlobalAdmin: existing?.isGlobalAdmin ?? false,
      };
      if (existing) {
        return prev.map((u) => (u.id === userId ? row : u));
      }
      return [...prev, row].sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
    });
  }

  async function onStaffRoleChange(user: PermissionUserRow, role: string) {
    const nextRole = role as "USER" | "ADMIN" | "ADMIN_TEAM";
    let managedTeamId: string | null = user.managedTeamId;

    if (nextRole === "ADMIN_TEAM") {
      managedTeamId = user.managedTeamId ?? teams[0]?.id ?? null;
      if (!managedTeamId) {
        toast.error("Cadastre uma equipe antes.");
        return;
      }
    } else {
      managedTeamId = null;
    }

    startTransition(async () => {
      const result = await updateUserRole({
        userId: user.id,
        role: nextRole,
        managedTeamId,
      });
      if (result.success) {
        applyLocal(user.id, nextRole, managedTeamId);
        toast.success(nextRole === "USER" ? "Permissão removida." : "Permissão atualizada.");
        refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function onTeamChange(user: PermissionUserRow, teamId: string) {
    if (user.role !== "ADMIN_TEAM") return;
    startTransition(async () => {
      const result = await updateUserRole({
        userId: user.id,
        role: "ADMIN_TEAM",
        managedTeamId: teamId,
      });
      if (result.success) {
        applyLocal(user.id, "ADMIN_TEAM", teamId);
        toast.success("Equipe atualizada.");
        refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function submitNewPermission() {
    if (!pickedUser) {
      toast.error("Selecione um usuário.");
      return;
    }
    const managedTeamId = newRole === "ADMIN_TEAM" ? newTeamId.trim() : null;
    if (newRole === "ADMIN_TEAM" && !managedTeamId) {
      toast.error("Selecione a equipe.");
      return;
    }
    startTransition(async () => {
      const result = await updateUserRole({
        userId: pickedUser.id,
        role: newRole,
        managedTeamId,
      });
      if (result.success) {
        applyLocal(pickedUser.id, newRole, managedTeamId, pickedUser);
        toast.success("Permissão concedida.");
        setDialogOpen(false);
        resetDialog();
        refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function displayUser(u: Pick<PermissionUserRow, "id" | "name" | "email">) {
    return u.name?.trim() || u.email?.trim() || `Usuário ${u.id.slice(0, 6)}…`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Permissões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administradores do sistema e administradores de equipe. Use o botão para conceder
            acesso a outro usuário.
          </p>
        </div>
        <Button
          type="button"
          onClick={openDialog}
          className="shrink-0 bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar permissão
        </Button>
      </div>

      <Card className="rounded-xl border border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-muted p-2">
              <Shield className="h-5 w-5 text-foreground/80" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-foreground">Quem tem acesso</CardTitle>
              <CardDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Administrador</span> — todas as
                equipes e configurações.{" "}
                <span className="font-medium text-foreground">Administrador de equipe</span> — só
                uma equipe; não acessa esta tela nem o cadastro global de equipes. O{" "}
                <span className="font-medium text-foreground">administrador global</span> é definido
                no banco de dados e não pode ser alterado nesta tela.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum administrador cadastrado além de você? Use &quot;Adicionar permissão&quot; para
              incluir alguém.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {users.map((u) => {
                const sub = u.email?.trim() && u.email !== displayUser(u) ? u.email : null;
                const isSelf = u.id === currentUserId;
                const isGlobalLocked = u.isGlobalAdmin;

                return (
                  <li
                    key={u.id}
                    className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                        <span className="truncate">{displayUser(u)}</span>
                        {isGlobalLocked ? (
                          <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/55 dark:text-amber-200">
                            Admin global
                          </span>
                        ) : null}
                      </p>
                      {sub ? (
                        <p className="truncate text-xs text-muted-foreground">{sub}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Perfil:{" "}
                        <span className="font-medium text-foreground">
                          {u.role === "ADMIN"
                            ? "Administrador"
                            : "Administrador de equipe"}
                        </span>
                        {u.role === "ADMIN_TEAM" && u.managedTeamId ? (
                          <>
                            {" "}
                            — equipe:{" "}
                            <span className="font-medium text-foreground">
                              {teamById.get(u.managedTeamId) ?? "—"}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex w-full flex-col gap-3 sm:w-[280px] shrink-0">
                      {isGlobalLocked ? (
                        <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5 text-sm">
                          <p className="font-medium text-foreground">Protegido</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            Este administrador global é definido no banco de dados e não pode ser
                            alterado ou removido nesta tela.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Função</Label>
                            <Select
                              value={u.role === "ADMIN_TEAM" ? "ADMIN_TEAM" : "ADMIN"}
                              onValueChange={(v) => {
                                if (v === "REMOVE") {
                                  void onStaffRoleChange(u, "USER");
                                } else {
                                  void onStaffRoleChange(u, v);
                                }
                              }}
                              disabled={pending || isSelf}
                            >
                              <SelectTrigger className="h-10 w-full cursor-pointer">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ADMIN">Administrador</SelectItem>
                                <SelectItem value="ADMIN_TEAM">Administrador de equipe</SelectItem>
                                <SelectItem value="REMOVE" className="text-destructive">
                                  Remover permissão
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {isSelf ? (
                              <p className="text-xs text-muted-foreground">
                                Você não pode remover o seu próprio acesso aqui.
                              </p>
                            ) : null}
                          </div>

                          {u.role === "ADMIN_TEAM" ? (
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Equipe</Label>
                              <Select
                                value={u.managedTeamId ?? ""}
                                onValueChange={(v) => void onTeamChange(u, v)}
                                disabled={pending || isSelf || teams.length === 0}
                              >
                                <SelectTrigger className="h-10 w-full cursor-pointer">
                                  <SelectValue placeholder="Equipe" />
                                </SelectTrigger>
                                <SelectContent>
                                  {teams.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar permissão</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {!pickedUser ? (
              <div className="space-y-2">
                <Label htmlFor="perm-user-search">Buscar usuário</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="perm-user-search"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Nome ou e-mail (mín. 2 caracteres)"
                    className="h-10 pl-9"
                    autoComplete="off"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Somente usuários com perfil &quot;Usuário&quot; aparecem na busca.
                </p>
                <div
                  className="max-h-[220px] overflow-y-auto rounded-md border border-border/60 bg-muted/20"
                  role="listbox"
                  aria-label="Resultados da busca"
                >
                  {userLoading ? (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                      Buscando…
                    </p>
                  ) : userQuery.trim().length < 2 ? (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                      Digite pelo menos 2 caracteres.
                    </p>
                  ) : userHits.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                      Nenhum usuário encontrado.
                    </p>
                  ) : (
                    <ul className="p-1">
                      {userHits.map((hit) => (
                        <li key={hit.id}>
                          <button
                            type="button"
                            onClick={() => setPickedUser(hit)}
                            className={cn(
                              "flex w-full flex-col rounded-md px-3 py-2 text-left text-sm",
                              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            )}
                          >
                            <span className="font-medium text-foreground">
                              {displayUser(hit)}
                            </span>
                            {hit.email ? (
                              <span className="text-xs text-muted-foreground">{hit.email}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{displayUser(pickedUser)}</p>
                  {pickedUser.email ? (
                    <p className="text-xs text-muted-foreground">{pickedUser.email}</p>
                  ) : null}
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                    onClick={() => setPickedUser(null)}
                  >
                    Trocar usuário
                  </button>
                </div>

                <div className="space-y-1.5">
                  <Label>Tipo de permissão</Label>
                  <Select
                    value={newRole}
                    onValueChange={(v) => setNewRole(v as "ADMIN" | "ADMIN_TEAM")}
                  >
                    <SelectTrigger className="h-10 w-full cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {STAFF_ROLE_OPTIONS.find((o) => o.value === newRole)?.hint}
                  </p>
                </div>

                {newRole === "ADMIN_TEAM" ? (
                  <div className="space-y-2">
                    <Label htmlFor="perm-team-search">Equipe</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="perm-team-search"
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        placeholder="Filtrar equipes…"
                        className="h-10 pl-9"
                      />
                    </div>
                    <div className="max-h-[160px] overflow-y-auto rounded-md border border-border/60 bg-muted/20 p-1">
                      {teams.length === 0 ? (
                        <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                          Nenhuma equipe cadastrada.
                        </p>
                      ) : filteredTeams.length === 0 ? (
                        <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                          Nenhuma equipe com esse nome.
                        </p>
                      ) : (
                        <ul>
                          {filteredTeams.map((t) => (
                            <li key={t.id}>
                              <button
                                type="button"
                                onClick={() => setNewTeamId(t.id)}
                                className={cn(
                                  "flex w-full rounded-md px-3 py-2 text-left text-sm font-medium",
                                  newTeamId === t.id
                                    ? "bg-muted text-foreground"
                                    : "hover:bg-muted/80 text-foreground"
                                )}
                              >
                                {t.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            {pickedUser ? (
              <Button
                type="button"
                onClick={() => void submitNewPermission()}
                disabled={
                  pending ||
                  (newRole === "ADMIN_TEAM" && (!newTeamId || teams.length === 0))
                }
                className="cursor-pointer"
              >
                {pending ? "Salvando…" : "Conceder permissão"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
