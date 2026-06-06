import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const acknowledged = searchParams.get("acknowledged");
  const severity     = searchParams.get("severity");
  const page         = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const pageSize     = Math.min(100, parseInt(searchParams.get("limit") ?? "10"));
  const skip         = (page - 1) * pageSize;

  const sensorId = searchParams.get("sensorId");

  const where: Record<string, unknown> = {};
  if (acknowledged !== null && acknowledged !== "") {
    where.acknowledged = acknowledged === "true";
  }
  if (severity)  where.severity = severity;
  if (sensorId)  where.sensorId = sensorId;

  const [total, activeCount, alerts] = await Promise.all([
    prisma.alert.count({ where }),
    prisma.alert.count({ where: { ...where, acknowledged: false } }),
    prisma.alert.findMany({
      where,
      include: {
        sensor: {
          include: {
            device: { include: { zone: { include: { hospital: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    alerts,
    total,
    activeCount,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function PATCH(request: NextRequest) {
  const { id, acknowledged } = await request.json();
  const alert = await prisma.alert.update({
    where: { id },
    data:  { acknowledged },
  });
  return NextResponse.json(alert);
}