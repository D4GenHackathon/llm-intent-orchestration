import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const deviceSchema = z.object({
  name:   z.string().min(1),
  type:   z.string().min(1),
  zoneId: z.string().min(1),
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE", "ERROR"]).optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const pageSize = Math.min(50, parseInt(searchParams.get("limit") ?? "10"));
  const searchId = searchParams.get("searchId");

  // Find which page a specific device is on
  if (searchId) {
    const allIds = await prisma.device.findMany({
      orderBy: { name: "asc" },
      select:  { id: true },
    });
    const idx  = allIds.findIndex((d) => d.id === searchId);
    const page = idx === -1 ? 1 : Math.floor(idx / pageSize) + 1;
    return NextResponse.json({ page });
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const skip = (page - 1) * pageSize;

  const [total, devices] = await Promise.all([
    prisma.device.count(),
    prisma.device.findMany({
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
      select: {
        id:       true,
        name:     true,
        type:     true,
        status:   true,
        lastSeen: true,
        sensors:  { select: { id: true } },
        zone: {
          select: {
            name:     true,
            hospital: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    devices,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body   = await request.json();
    const data   = deviceSchema.parse(body);
    const device = await prisma.device.create({
      data,
      include: { zone: { include: { hospital: true } }, sensors: true },
    });
    return NextResponse.json(device, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}