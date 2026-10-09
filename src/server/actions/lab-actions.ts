"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { getMessages } from "@/i18n/server";

export async function updateLabStatus(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const labId = formData.get("labId") as string;
  const status = formData.get("status") as string;

  if (!labId || !status) return { error: (await getMessages()).academics.errLab };

  await prisma.labSession.update({
    where: { id: labId, userId: user.id },
    data: { status },
  });

  revalidatePath("/labs");
  return { success: true };
}
