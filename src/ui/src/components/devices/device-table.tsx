"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeviceStatusBadge } from "./device-status-badge";
import { Button } from "@/components/ui/button";
import { Trash2, Map } from "lucide-react";
import { DeviceDetail } from "./device-detail";

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

interface DeviceTableProps {
  devices: Device[];
  onRefresh: () => void;
  onViewOnMap?: (device: Device) => void;
  highlightDeviceId?: string | null;
}

export function DeviceTable({ devices, onRefresh, onViewOnMap, highlightDeviceId }: DeviceTableProps) {
  const [selected, setSelected] = useState<Device | null>(null);

  // Auto-open detail panel when arriving with ?highlight=id
  useEffect(() => {
    if (highlightDeviceId && devices.length > 0) {
      const match = devices.find((d) => d.id === highlightDeviceId);
      if (match) setSelected(match);
    }
  }, [highlightDeviceId, devices]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this device?")) return;
    await fetch(`/api/devices/${id}`, { method: "DELETE" });
    onRefresh();
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No devices found. Add a device to get started.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Sensors</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => (
              <TableRow
                key={device.id}
                className="cursor-pointer group"
                onClick={() => setSelected(device)}
              >
                <TableCell className="font-medium">{device.name}</TableCell>
                <TableCell>{device.type}</TableCell>
                <TableCell>
                  <DeviceStatusBadge status={device.status} />
                </TableCell>
                <TableCell>
                  {device.zone.hospital.name} / {device.zone.name}
                </TableCell>
                <TableCell>{device.sensors.length}</TableCell>
                <TableCell>
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onViewOnMap && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="View on map"
                        onClick={() => onViewOnMap(device)}
                      >
                        <Map className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(device.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DeviceDetail
        device={selected}
        onClose={() => setSelected(null)}
        onViewOnMap={
          onViewOnMap
            ? (dev) => {
                setSelected(null);
                onViewOnMap(dev);
              }
            : undefined
        }
      />
    </>
  );
}