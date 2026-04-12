import { NextResponse } from "next/server";
import { executeCapitalSnapshot } from "@/lib/capitalSnapshotJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse<{ created: number; skipped: number } | { error: string }>> {
  try {
    const result = await executeCapitalSnapshot();
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось создать снимки.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
