"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { CreateTeamMemberInput } from "@/lib/validations/team";
import { createTeamMemberSchema } from "@/lib/validations/team";

export type CreateTeamMemberResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createTeamMember(
  input: CreateTeamMemberInput
): Promise<CreateTeamMemberResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acesso negado. Apenas administradores podem adicionar membros." };
  }

  const parsed = createTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(". "),
      fieldErrors,
    };
  }

  try {
    const member = await prisma.teamMember.create({
      data: {
        name: parsed.data.name.trim(),
        phone: parsed.data.phone.trim(),
        level: parsed.data.level,
        shift: parsed.data.shift,
        sobreaviso: parsed.data.sobreaviso ?? false,
      },
    });
    return { success: true, data: { id: member.id } };
  } catch (e) {
    return {
      success: false,
      error: "Erro ao criar membro. Tente novamente.",
    };
  }
}
