"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Cpu, Activity, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";

const HospitalMap3D = dynamic(
  () => import("@/components/hospitals/HospitalMap3D"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-48 rounded-lg border text-muted-foreground text-sm">
        Loading 3D map…
      </div>
    ),
  }
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

const ZONE_COLORS: number[] = [
  0xe05252, 0xe07d35, 0x5a8ae0, 0x4eb88a,
  0x9b59b6, 0x2ecc71, 0xf39c12, 0x1abc9c,
];

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
  const floorMap: Map<string, typeof hospital.zones> = new Map();

  hospital.zones.forEach((zone) => {
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
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const mapRef       = useRef<HTMLDivElement>(null);

  const [hospital, setHospital] = useState<Hospital | null>(null);

  // ?zone= passed from the devices page "View on map" button
  // Already stripped of floor prefix by the sender
  const highlightZone = searchParams.get("zone") ?? undefined;

  const initialFloor = (() => {
    if (!hospital || !highlightZone) return 0;
    const mapData = toMapData(hospital);
    const idx = mapData.floors.findIndex((f) =>
      f.zones.some((z) => z.name === highlightZone)
    );
    return idx >= 0 ? idx : 0;
  })();

  useEffect(() => {
    fetch(`/api/hospitals/${params.id}`)
      .then((res) => res.json())
      .then(setHospital);
  }, [params.id]);

  // Scroll to map when arriving with ?zone=
  useEffect(() => {
    if (hospital && highlightZone && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    }
  }, [hospital, highlightZone]);

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
      <div ref={mapRef} className="scroll-mt-6">
        {highlightZone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 px-1">
            <span>Highlighting</span>
            <span className="font-medium text-foreground bg-muted rounded px-2 py-0.5">
              {highlightZone}
            </span>
            <Link
              href={`/hospitals/${params.id}`}
              className="ml-auto text-xs underline-offset-2 hover:underline"
            >
              Clear
            </Link>
          </div>
        )}
        <HospitalMap3D
          hospitalData={toMapData(hospital)}
          initialFloor={initialFloor}
          highlightZone={highlightZone}
        />
      </div>

      {/* Zones + devices list */}
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
              <div className="space-y-2">
                {zone.devices.map((device) => (
                  <Link
                    key={device.id}
                    href={`/devices?highlight=${device.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors group"
                  >
                    <div>
                      <p className="font-medium group-hover:text-foreground">{device.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {device.sensors.length} sensor{device.sensors.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={device.status === "ONLINE" ? "default" : "secondary"}>
                        {device.status}
                      </Badge>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
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