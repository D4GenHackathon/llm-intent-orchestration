"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DeviceTable } from "@/components/devices/device-table";
import { DeviceForm } from "@/components/devices/device-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Zone {
  id: string;
  name: string;
  hospitalName: string;
  hospital: { id: string; name: string };
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSeen: string;
  sensors: { id: string }[];
  zone: {
    name: string;
    hospital: { name: string; id: string };
  };
}

export default function DevicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [devices, setDevices] = useState<Device[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(searchParams.get("highlight"));
  const [zones, setZones] = useState<Zone[]>([]);
  const [open, setOpen] = useState(false);

  async function loadDevices() {
    const res = await fetch("/api/devices");
    setDevices(await res.json());
  }

  async function loadZones() {
    const res = await fetch("/api/hospitals");
    const hospitals = await res.json();
    const allZones = hospitals.flatMap((h: any) =>
      h.zones.map((z: any) => ({ ...z, hospitalName: h.name }))
    );
    setZones(allZones);
  }

  useEffect(() => {
    loadDevices();
    loadZones();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="text-muted-foreground">Manage and monitor your devices</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Device</DialogTitle>
            </DialogHeader>
            <DeviceForm
              zones={zones}
              onSuccess={() => {
                setOpen(false);
                loadDevices();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DeviceTable
        devices={devices}
        onRefresh={loadDevices}
        highlightDeviceId={highlightId}
        onViewOnMap={(device) => {
          const hospitalId = device.zone.hospital.id;
          // Strip floor prefix "Floor 2 – Zone Name" → "Zone Name" before passing
          const zoneName = device.zone.name.includes(" – ")
            ? device.zone.name.split(" – ")[1]
            : device.zone.name;
          router.push(`/hospitals/${hospitalId}?zone=${encodeURIComponent(zoneName)}`);
        }}
      />
    </div>
  );
}