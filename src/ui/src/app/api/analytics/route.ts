import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const hours      = parseInt(searchParams.get("hours")      ?? "168");
  const sensorType = searchParams.get("sensorType");
  const sensorId   = searchParams.get("sensorId");   // drill-down to one sensor
  const since      = new Date(Date.now() - hours * 60 * 60 * 1000);

  // ── Summary stats per sensor (no readings — fast) ────────────────────────
  if (!sensorId) {
    const where: any = { timestamp: { gte: since } };
    if (sensorType) where.sensor = { type: sensorType };

    const [totalReadings, grouped] = await Promise.all([
      prisma.sensorReading.count({ where }),
      prisma.sensorReading.groupBy({
        by: ["sensorId"],
        where,
        _count: { value: true },
        _min:   { value: true },
        _max:   { value: true },
        _avg:   { value: true },
      }),
    ]);

    // Fetch sensor metadata separately
    const sensorIds = grouped.map((g) => g.sensorId);
    const sensors   = await prisma.sensor.findMany({
      where: { id: { in: sensorIds } },
      select: { id: true, name: true, type: true, unit: true },
    });
    const sensorMap = Object.fromEntries(sensors.map((s) => [s.id, s]));

    const stats = grouped.map((g) => ({
      sensorId:   g.sensorId,
      sensorName: sensorMap[g.sensorId]?.name ?? "Unknown",
      sensorType: sensorMap[g.sensorId]?.type ?? "UNKNOWN",
      unit:       sensorMap[g.sensorId]?.unit ?? "",
      count:      g._count.value,
      min:        g._min.value  ?? 0,
      max:        g._max.value  ?? 0,
      avg:        g._avg.value  ?? 0,
    }));

    return NextResponse.json({ stats, totalReadings });
  }

  // ── Drill-down: readings for one sensor ──────────────────────────────────
  const [sensor, readings] = await Promise.all([
    prisma.sensor.findUnique({
      where: { id: sensorId },
      select: { id: true, name: true, type: true, unit: true },
    }),
    prisma.sensorReading.findMany({
      where:   { sensorId, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
      take:    500, // cap for chart perf
      select:  { value: true, timestamp: true },
    }),
  ]);

  return NextResponse.json({
    sensor,
    readings: readings.map((r) => ({
      value:     r.value,
      timestamp: r.timestamp.toISOString(),
    })),
  });
}