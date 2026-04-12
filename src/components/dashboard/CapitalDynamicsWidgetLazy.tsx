"use client";

import dynamic from "next/dynamic";
import type { CapitalHistoryDay } from "@/types/capitalHistory";

const Inner = dynamic(
  () => import("./CapitalDynamicsWidget").then((m) => m.CapitalDynamicsWidget),
  {
    ssr: false,
    loading: () => (
      <div className="h-28 mb-6 rounded-xl border border-[hsl(216,34%,17%)] bg-[hsl(222,47%,8%)] animate-pulse" />
    ),
  }
);

export function CapitalDynamicsWidgetLazy(props: {
  points: CapitalHistoryDay[];
  monthDelta: number;
  currency: string;
}) {
  return <Inner {...props} />;
}
