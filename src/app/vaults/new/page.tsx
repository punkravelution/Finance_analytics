import { Vault } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VaultForm } from "@/components/forms/VaultForm";
import { createVault } from "@/app/actions/vault";

export default function NewVaultPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-7">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Vault size={22} className="text-blue-400" />
          Новое хранилище
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры хранилища</CardTitle>
        </CardHeader>
        <CardContent>
          <VaultForm action={createVault} cancelHref="/vaults" submitLabel="Создать хранилище" />
        </CardContent>
      </Card>
    </div>
  );
}
