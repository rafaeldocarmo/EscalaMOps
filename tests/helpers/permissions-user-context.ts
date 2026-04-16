import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/lib/generated/prisma/enums";

export async function createPermissionTestTeam() {
  const suffix = randomBytes(3).toString("hex");
  return prisma.team.create({
    data: { name: `mops-perm-${suffix}`, isDefault: false },
  });
}

export async function createPermissionTestUser(opts: {
  email: string;
  role: UserRole;
  isGlobalAdmin?: boolean;
  managedTeamId?: string | null;
}) {
  return prisma.user.create({
    data: {
      email: opts.email,
      name: "Usuário perm teste",
      role: opts.role,
      isGlobalAdmin: opts.isGlobalAdmin ?? false,
      managedTeamId: opts.managedTeamId ?? null,
    },
  });
}

export async function deletePermissionTestUser(userId: string): Promise<void> {
  await prisma.user.deleteMany({ where: { id: userId } });
}

export async function deletePermissionTestTeam(teamId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { managedTeamId: teamId },
    data: { managedTeamId: null },
  });
  await prisma.team.deleteMany({ where: { id: teamId } });
}
