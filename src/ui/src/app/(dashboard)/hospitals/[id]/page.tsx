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
function toMapData(hospital: Hospital) {
  const ZONES_PER_FLOOR = 4;
  const ZONE_COLORS: Record<string, number> = {
    0: 0xe05252, 1: 0xe07d35, 2: 0x5a8ae0, 3: 0x4eb88a,
    4: 0x9b59b6, 5: 0x2ecc71, 6: 0xf39c12, 7: 0x1abc9c,
  };
  const ZONE_LAYOUTS = [
    { x: -5, z: -3, w: 5, d: 4 },
    { x:  1, z: -3, w: 5, d: 4 },
    { x: -5, z:  2, w: 5, d: 4 },
    { x:  1, z:  2, w: 5, d: 4 },
  ];
  const DEVICE_OFFSETS = [
    [[-0.9, -0.5], [0.9,  0.5]],
    [[-0.9,  0.5], [0.9, -0.5]],
    [[ 0.0, -0.8], [0.0,  0.8]],
    [[-0.7, -0.7], [0.7,  0.7]],
  ];

  const floors = [];
  for (let fi = 0; fi * ZONES_PER_FLOOR < hospital.zones.length; fi++) {
    const chunk = hospital.zones.slice(fi * ZONES_PER_FLOOR, (fi + 1) * ZONES_PER_FLOOR);
    floors.push({
      level: fi,
      label: fi === 0 ? "Ground Floor" : `Floor ${fi}`,
      zones: chunk.map((zone, zi) => {
        const layout = ZONE_LAYOUTS[zi % ZONE_LAYOUTS.length];
        const offsets = DEVICE_OFFSETS[zi % DEVICE_OFFSETS.length];
        return {
          id: zone.id,
          name: zone.name,
          type: "general",
          x: layout.x,
          z: layout.z,
          w: layout.w,
          d: layout.d,
          color: ZONE_COLORS[zi % 8],
          devices: zone.devices.slice(0, 4).map((dev, di) => {
            const [ox, oz] = offsets[di % offsets.length];
            return {
              id: dev.id,
              name: dev.name,
              status: dev.status,
              x: layout.x + layout.w / 2 + ox,
              z: layout.z + layout.d / 2 + oz,
            };
          }),
        };
      }),
    });
  }

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
