import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name:   z.string().min(1).optional(),
  type:   z.string().min(1).optional(),
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE", "ERROR"]).optional(),
  zoneId: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      sensors: {
        include: {
          readings: {
            take: 30,                          // ← was 1, now 30 for sparklines
            orderBy: { timestamp: "asc" },     // asc so sparkline reads left→right
          },
        },
      },
      zone: { include: { hospital: true } },
    },
  });

  if (!device) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(device);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await request.json();
    const data   = updateSchema.parse(body);
    const device = await prisma.device.update({
      where: { id },
      data,
      include: { zone: { include: { hospital: true } }, sensors: true },
    });
    return NextResponse.json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.device.delete({ where: { id } });
  return NextResponse.json({ success: true });
}