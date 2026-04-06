"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface VaultActionState {
  errors?: {
    name?: string;
    type?: string;
    general?: string;
  };
}

function parseVaultFormData(formData: FormData) {
  return {
    name: formData.get("name")?.toString().trim() ?? "",
    type: formData.get("type")?.toString() ?? "",
    currency: formData.get("currency")?.toString().trim() || "RUB",
    liquidityLevel: formData.get("liquidityLevel")?.toString() || "medium",
    riskLevel: formData.get("riskLevel")?.toString() || "low",
    includeInNetWorth: formData.get("includeInNetWorth") === "on",
    notes: formData.get("notes")?.toString().trim() || null,
  };
}

function validateVaultData(data: ReturnType<typeof parseVaultFormData>) {
  const errors: NonNullable<VaultActionState["errors"]> = {};
  if (!data.name) errors.name = "Укажите название";
  if (!data.type) errors.type = "Выберите тип";
  return errors;
}

export async function createVault(
  _prev: VaultActionState,
  formData: FormData
): Promise<VaultActionState> {
  const data = parseVaultFormData(formData);
  const errors = validateVaultData(data);
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.vault.create({ data });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/vaults");
  redirect("/vaults");
}

export async function updateVault(
  id: string,
  _prev: VaultActionState,
  formData: FormData
): Promise<VaultActionState> {
  const data = parseVaultFormData(formData);
  const errors = validateVaultData(data);
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.vault.update({ where: { id }, data });
  } catch {
    return { errors: { general: "Ошибка сохранения. Попробуйте ещё раз." } };
  }

  revalidatePath("/vaults");
  revalidatePath(`/vaults/${id}`);
  redirect(`/vaults/${id}`);
}

export async function deleteVault(id: string): Promise<void> {
  await prisma.vault.update({ where: { id }, data: { isActive: false } });
  revalidatePath("/vaults");
  redirect("/vaults");
}
