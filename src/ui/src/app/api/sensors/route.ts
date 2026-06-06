import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const sensorSchema = z.object({
  name:     z.string().min(1),
  type:     z.enum(["TEMPERATURE", "HUMIDITY", "SOIL_MOISTURE", "LIGHT", "CO2"]),
  unit:     z.string().min(1),
  deviceId: z.string().min(1),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page     = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const pageSize = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
  const skip     = (page - 1) * pageSize;

  const [total, sensors] = await Promise.all([
    prisma.sensor.count(),
    prisma.sensor.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id:   true,
        name: true,
        type: true,
        unit: true,
        // Latest single reading for the card value — cheap
        readings: {
          take: 1,
          orderBy: { timestamp: "desc" },
          select: { value: true, timestamp: true },
        },
        device: {
          select: {
            name: true,
            zone: {
              select: {
                name:     true,
                hospital: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    sensors,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body   = await request.json();
    const data   = sensorSchema.parse(body);
    const sensor = await prisma.sensor.create({
      data,
      include: { device: { include: { zone: { include: { hospital: true } } } } },
    });
    return NextResponse.json(sensor, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}