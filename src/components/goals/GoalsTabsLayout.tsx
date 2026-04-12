"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GoalsTabsLayoutProps {
  defaultTab: "goals" | "planned";
  goalsTab: React.ReactNode;
  plannedTab: React.ReactNode;
}

export function GoalsTabsLayout({ defaultTab, goalsTab, plannedTab }: GoalsTabsLayoutProps) {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="w-full max-w-md grid grid-cols-2">
        <TabsTrigger value="goals">Цели накопления</TabsTrigger>
        <TabsTrigger value="planned">Запланированные платежи</TabsTrigger>
      </TabsList>
      <TabsContent value="goals">{goalsTab}</TabsContent>
      <TabsContent value="planned">{plannedTab}</TabsContent>
    </Tabs>
  );
}
