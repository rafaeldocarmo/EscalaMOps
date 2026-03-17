"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import type { UpdateTeamMemberInput } from "@/lib/validations/team";
import { updateTeamMemberSchema } from "@/lib/validations/team";

export type UpdateTeamMemberResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateTeamMember(
  id: string,
  input: UpdateTeamMemberInput
): Promise<UpdateTeamMemberResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Acesso negado. Apenas administradores podem editar membros." };
  }

  const parsed = updateTeamMemberSchema.safeParse(input);
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
    const normalizedPhone = normalizePhone(parsed.data.phone).trim();
    await prisma.teamMember.update({
      where: { id },
      data: {
        name: parsed.data.name.trim(),
        phone: parsed.data.phone.trim(),
        normalizedPhone,
        level: parsed.data.level,
        shift: parsed.data.shift,
        sobreaviso: parsed.data.sobreaviso ?? false,
        participatesInSchedule: parsed.data.participatesInSchedule ?? true,
      },
    });
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: "Erro ao atualizar membro. Tente novamente.",
    };
  }
}
