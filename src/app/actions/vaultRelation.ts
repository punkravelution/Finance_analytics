"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface VaultRelationActionState {
  errors?: {
    fromVaultId?: string;
    toVaultId?: string;
    relationType?: string;
    strength?: string;
    general?: string;
  };
}

function parseVaultRelationFormData(formData: FormData) {
  const strengthStr = formData.get("strength")?.toString() ?? "";
  const strength = parseFloat(strengthStr);
  return {
    fromVaultId: formData.get("fromVaultId")?.toString() ?? "",
    toVaultId: formData.get("toVaultId")?.toString() ?? "",
    relationType: formData.get("relationType")?.toString() ?? "",
    strength: isNaN(strength) ? 1.0 : strength,
    note: formData.get("note")?.toString().trim() || null,
  };
}

function validateVaultRelationData(
  data: ReturnType<typeof parseVaultRelationFormData>
) {
  const errors: NonNullable<VaultRelationActionState["errors"]> = {};
  if (!data.fromVaultId) errors.fromVaultId = "Выберите источник";
  if (!data.toVaultId) errors.toVaultId = "Выберите назначение";
  if (
    data.fromVaultId &&
    data.toVaultId &&
    data.fromVaultId === data.toVaultId
  ) {
    errors.toVaultId = "Нельзя связывать хранилище само с собой";
  }
  if (!data.relationType) errors.relationType = "Выберите тип связи";
  if (data.strength <= 0) errors.strength = "Сила связи должна быть больше 0";
  return errors;
}

export async function createVaultRelation(
  _prev: VaultRelationActionState,
  formData: FormData
): Promise<VaultRelationActionState> {
  const data = parseVaultRelationFormData(formData);
  const errors = validateVaultRelationData(data);
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.vaultRelation.create({ data });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath(`/vaults/${data.fromVaultId}`);
  revalidatePath(`/vaults/${data.toVaultId}`);
  revalidatePath("/vaults");
  redirect(`/vaults/${data.fromVaultId}`);
}

export async function updateVaultRelation(
  id: string,
  _prev: VaultRelationActionState,
  formData: FormData
): Promise<VaultRelationActionState> {
  const data = parseVaultRelationFormData(formData);
  const errors = validateVaultRelationData(data);
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.vaultRelation.update({ where: { id }, data });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath(`/vaults/${data.fromVaultId}`);
  revalidatePath(`/vaults/${data.toVaultId}`);
  revalidatePath("/vaults");
  redirect(`/vaults/${data.fromVaultId}`);
}

export async function deleteVaultRelation(
  id: string,
  vaultId: string
): Promise<void> {
  const rel = await prisma.vaultRelation.findUnique({
    where: { id },
    select: { fromVaultId: true, toVaultId: true },
  });
  await prisma.vaultRelation.delete({ where: { id } });
  if (rel) {
    revalidatePath(`/vaults/${rel.fromVaultId}`);
    revalidatePath(`/vaults/${rel.toVaultId}`);
  }
  revalidatePath("/vaults");
  revalidatePath(`/vaults/${vaultId}`);
  redirect(`/vaults/${vaultId}`);
}
