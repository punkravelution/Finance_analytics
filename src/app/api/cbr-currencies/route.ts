import { NextResponse } from "next/server";
import { fetchCbrDailyXml, parseXmlDate, parseValutes } from "@/lib/cbrXml";

export const runtime = "nodejs";

/** Список валют из текущей выгрузки ЦБ (для выбора при добавлении валюты). */
export async function GET() {
  try {
    const xml = await fetchCbrDailyXml();
    const date = parseXmlDate(xml);
    const valutes = parseValutes(xml).filter((r) => /^[A-Z]{3}$/.test(r.code) && r.code !== "RUB");

    return NextResponse.json({
      ok: true as const,
      date: date.toISOString(),
      currencies: valutes.map((v) => ({
        code: v.code,
        name: v.name,
        nominal: v.nominal,
        rubPerUnit: v.value / v.nominal,
      })),
    });
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Не удалось загрузить список валют ЦБ РФ" },
      { status: 502 }
    );
  }
}
