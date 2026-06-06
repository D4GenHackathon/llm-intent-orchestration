"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DeviceTable } from "@/components/devices/device-table";
import { DeviceForm } from "@/components/devices/device-form";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogTrigger,
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
    hospital: { id: string; name: string };
  };
}

const PAGE_SIZE = 10;

export default function DevicesPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const highlightId  = searchParams.get("highlight");

  const [devices,    setDevices]    = useState<Device[]>([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [zones,      setZones]      = useState<Zone[]>([]);
  const [open,       setOpen]       = useState(false);

  // Track whether we've resolved the highlight page yet
  const highlightResolved = useRef(false);

  async function loadDevices(p: number) {
    setLoading(true);
    try {
      const res  = await fetch(`/api/devices?page=${p}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      setDevices(data.devices ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }

  async function loadZones() {
    const res       = await fetch("/api/hospitals");
    const hospitals = await res.json();
    const allZones  = hospitals.flatMap((h: any) =>
      Array.isArray(h.zones)
        ? h.zones.map((z: any) => ({ ...z, hospitalName: h.name }))
        : []
    );
    setZones(allZones);
  }

  // On mount: if highlight param present, find its page first then load.
  // Otherwise load page 1 directly.
  useEffect(() => {
    loadZones();

    if (highlightId && !highlightResolved.current) {
      highlightResolved.current = true;
      fetch(`/api/devices?searchId=${highlightId}&limit=${PAGE_SIZE}`)
        .then((r) => r.json())
        .then((data) => {
          const targetPage = data.page ?? 1;
          setPage(targetPage);
          loadDevices(targetPage);
        })
        .catch(() => loadDevices(1));
    } else {
      loadDevices(1);
    }
  }, []); // run once on mount

  // When user manually changes page via pagination
  function handlePageChange(p: number) {
    setPage(p);
    loadDevices(p);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="text-muted-foreground">
            Manage and monitor your devices
            {total > 0 && <span className="ml-1 text-sm">· {total} total</span>}
          </p>
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
                loadDevices(1);
                setPage(1);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="rounded-md border divide-y">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-32" />
              <div className="h-4 bg-muted rounded w-16" />
              <div className="h-5 bg-muted rounded-full w-16" />
              <div className="h-4 bg-muted rounded w-48" />
              <div className="h-4 bg-muted rounded w-8 ml-auto" />
            </div>
          ))}
        </div>
      ) : (
        <DeviceTable
          devices={devices}
          total={total}
          totalPages={totalPages}
          page={page}
          onPageChange={handlePageChange}
          onRefresh={() => loadDevices(page)}
          highlightDeviceId={highlightId}
          onViewOnMap={(device) => {
            const hospitalId = device.zone.hospital.id;
            const zoneName   = device.zone.name.includes(" \u2013 ")
              ? device.zone.name.split(" \u2013 ")[1]
              : device.zone.name;
            router.push(`/hospitals/${hospitalId}?zone=${encodeURIComponent(zoneName)}`);
          }}
        />
      )}
    </div>
  );
}