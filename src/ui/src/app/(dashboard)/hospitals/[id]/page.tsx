"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Cpu, Activity, Trash2 } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const HospitalMap3D = dynamic(
  () => import("@/components/hospitals/HospitalMap3D"),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-48 rounded-lg border text-muted-foreground text-sm">
      Loading 3D map…
    </div>
  )}
);

interface Hospital {
  id: string;
  name: string;
  location: string;
  description: string | null;
  zones: {
    id: string;
    name: string;
    description: string | null;
    devices: {
      id: string;
      name: string;
      status: string;
      sensors: {
        id: string;
        name: string;
        type: string;
        unit: string;
        readings: { value: number; timestamp: string }[];
      }[];
    }[];
  }[];
}

// Adapt API response to the shape HospitalMap3D expects.
// The component groups devices into floors — since the API has flat zones,
// we split them into chunks of 4 per floor.
const ZONE_COLORS: number[] = [
  0xe05252, 0xe07d35, 0x5a8ae0, 0x4eb88a,
  0x9b59b6, 0x2ecc71, 0xf39c12, 0x1abc9c,
];
 
// 8 zones in a 4-column × 2-row grid matching HospitalMap3D's ZONE_LAYOUTS
const ZONE_LAYOUTS = [
  { x: -13, z: -7, w: 6, d: 6 },
  { x: -6,  z: -7, w: 6, d: 6 },
  { x:  1,  z: -7, w: 6, d: 6 },
  { x:  8,  z: -7, w: 6, d: 6 },
  { x: -13, z:  2, w: 6, d: 6 },
  { x: -6,  z:  2, w: 6, d: 6 },
  { x:  1,  z:  2, w: 6, d: 6 },
  { x:  8,  z:  2, w: 6, d: 6 },
];
 
const DEVICE_OFFSETS = [[-1.5, -1.5], [1.5, -1.5]];
 
function toMapData(hospital: Hospital) {
  const ZONES_PER_FLOOR = 8;
 
  // Group flat zones into floors of 8
  const floorMap: Map<string, typeof hospital.zones> = new Map();
  hospital.zones.forEach((zone) => {
    // Zone names are seeded as "Ground Floor – Reception & Triage" etc.
    const dashIdx = zone.name.indexOf(" – ");
    const floorLabel = dashIdx > -1 ? zone.name.slice(0, dashIdx) : "Ground Floor";
    if (!floorMap.has(floorLabel)) floorMap.set(floorLabel, []);
    floorMap.get(floorLabel)!.push(zone);
  });
 
  const floors = Array.from(floorMap.entries()).map(([label, zones], fi) => ({
    level: fi,
    label,
    zones: zones.slice(0, ZONES_PER_FLOOR).map((zone, zi) => {
      const layout = ZONE_LAYOUTS[zi % ZONE_LAYOUTS.length];
      return {
        id: zone.id,
        name: zone.name.includes(" – ") ? zone.name.split(" – ")[1] : zone.name,
        type: "general",
        x: layout.x,
        z: layout.z,
        w: layout.w,
        d: layout.d,
        color: ZONE_COLORS[zi % ZONE_COLORS.length],
        devices: zone.devices.slice(0, 2).map((dev, di) => {
          const [ox, oz] = DEVICE_OFFSETS[di % DEVICE_OFFSETS.length];
          const cx = layout.x + layout.w / 2;
          const cz = layout.z + layout.d / 2;
          return {
            id: dev.id,
            name: dev.name,
            status: dev.status,
            x: cx + ox,
            z: cz + oz,
          };
        }),
      };
    }),
  }));
 
  return { name: hospital.name, floors };
}

export default function HospitalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [hospital, setHospital] = useState<Hospital | null>(null);

  useEffect(() => {
    fetch(`/api/hospitals/${params.id}`)
      .then((res) => res.json())
      .then(setHospital);
  }, [params.id]);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this hospital?")) return;
    await fetch(`/api/hospitals/${params.id}`, { method: "DELETE" });
    router.push("/hospitals");
  }

  if (!hospital) return <div className="p-6">Loading...</div>;

  const totalDevices = hospital.zones.reduce((acc, z) => acc + z.devices.length, 0);
  const totalSensors = hospital.zones.reduce(
    (acc, z) => acc + z.devices.reduce((a, d) => a + d.sensors.length, 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/hospitals">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{hospital.name}</h1>
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="text-sm">{hospital.location}</span>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      {hospital.description && (
        <p className="text-muted-foreground">{hospital.description}</p>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{hospital.zones.length}</div>
            <p className="text-sm text-muted-foreground">Zones</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold">{totalDevices}</div>
            </div>
            <p className="text-sm text-muted-foreground">Devices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold">{totalSensors}</div>
            </div>
            <p className="text-sm text-muted-foreground">Sensors</p>
          </CardContent>
        </Card>
      </div>

      {/* 3D Map */}
      <HospitalMap3D hospitalData={toMapData(hospital)} />

      {/* Zones list */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Zones</h2>
        {hospital.zones.map((zone) => (
          <Card key={zone.id}>
            <CardHeader>
              <CardTitle className="text-lg">{zone.name}</CardTitle>
              {zone.description && (
                <p className="text-sm text-muted-foreground">{zone.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {zone.devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {device.sensors.length} sensors
                      </p>
                    </div>
                    <Badge variant={device.status === "ONLINE" ? "default" : "secondary"}>
                      {device.status}
                    </Badge>
                  </div>
                ))}
                {zone.devices.length === 0 && (
                  <p className="text-sm text-muted-foreground">No devices in this zone</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {hospital.zones.length === 0 && (
          <p className="text-muted-foreground">No zones configured</p>
        )}
      </div>
    </div>
  );
}
