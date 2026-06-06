"use client";

import { useState, useEffect, useRef } from "react";
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
import { Trash2, Map, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
  total: number;
  totalPages: number;
  page: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onViewOnMap?: (device: Device) => void;
  highlightDeviceId?: string | null;
}

export function DeviceTable({
  devices,
  total,
  totalPages,
  page,
  onPageChange,
  onRefresh,
  onViewOnMap,
  highlightDeviceId,
}: DeviceTableProps) {
  // Selected holds the lightweight row device initially,
  // then gets replaced with the full detail (with readings) once fetched
  const [selected,      setSelected]      = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Open detail panel when devices load and highlight is present.
  // Uses a ref so it only fires once per highlight id.
  const lastHighlightOpened = useRef<string | null>(null);

  useEffect(() => {
    if (!highlightDeviceId || devices.length === 0) return;
    if (lastHighlightOpened.current === highlightDeviceId) return;
    const match = devices.find((d) => d.id === highlightDeviceId);
    if (match) {
      lastHighlightOpened.current = highlightDeviceId;
      openDetail(match);
    }
  }, [devices, highlightDeviceId]);

  // Fetch full device detail (with sensor readings) lazily
  async function openDetail(device: Device) {
    setSelected(device);       // show panel immediately with basic info
    setLoadingDetail(true);
    try {
      const res  = await fetch(`/api/devices/${device.id}`);
      const full = await res.json();
      setSelected(full);       // replace with full data including readings
    } catch {
      // keep showing basic info on error
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this device?")) return;
    await fetch(`/api/devices/${id}`, { method: "DELETE" });
    onRefresh();
  }

  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4)              return [1, 2, 3, 4, 5, "...", totalPages];
    if (page >= totalPages - 3) return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No devices found. Add a device to get started.
      </div>
    );
  }

  const start = (page - 1) * devices.length;

  return (
    <>
      <div className="space-y-3">
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
                  onClick={() => openDetail(device)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} of {total} devices
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {getPageNumbers().map((num, i) =>
                num === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={num}
                    variant={page === num ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 text-sm"
                    onClick={() => onPageChange(num as number)}
                  >
                    {num}
                  </Button>
                )
              )}

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <DeviceDetail
        device={selected}
        loadingDetail={loadingDetail}
        onClose={() => setSelected(null)}
        onViewOnMap={
          onViewOnMap
            ? (dev) => { setSelected(null); onViewOnMap(dev); }
            : undefined
        }
      />
    </>
  );
}