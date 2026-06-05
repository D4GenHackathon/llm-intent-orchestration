"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DeviceStatusBadge } from "./device-status-badge";
import { X, Map, Cpu, Wifi, Clock, Hash } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
// Extend the base Device type with optional richer fields from a detail fetch
interface Sensor {
  id: string;
  type: string;
  unit?: string;
  latestValue?: number;
  readings?: { value: number; recordedAt: string }[];
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSeen: string;
  firmware?: string;
  ipAddress?: string;
  sensors: { id: string; type?: string; unit?: string; latestValue?: number; readings?: { value: number; recordedAt: string }[] }[];
  zone: {
    name: string;
    hospital: { id: string; name: string };
  };
}

interface DeviceDetailProps {
  device: Device | null;
  onClose: () => void;
  onViewOnMap?: (device: Device) => void;
}

// ─── Sparkline canvas ─────────────────────────────────────────────────────────
const SENSOR_COLORS: Record<string, string> = {
  temperature: "#e07d35",
  humidity:    "#5a8ae0",
  pressure:    "#9b59b6",
  co2:         "#4eb88a",
  motion:      "#e05252",
  light:       "#f39c12",
};

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || values.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => ({
      x: (i / (values.length - 1)) * W,
      y: H - ((v - min) / range) * (H - 8) - 4,
    }));

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + "30");
    grad.addColorStop(1, color + "00");
    ctx.beginPath();
    ctx.moveTo(pts[0].x, H);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [values, color]);

  return <canvas ref={ref} width={130} height={40} className="block w-full" />;
}

// ─── Sensor card ─────────────────────────────────────────────────────────────
function SensorCard({ sensor }: { sensor: Device["sensors"][number] }) {
  const color = SENSOR_COLORS[sensor.type?.toLowerCase() ?? ""] ?? "#1abc9c";
  const readings = sensor.readings?.map((r) => r.value) ?? [];
  const latest = sensor.latestValue ?? readings[readings.length - 1];

  return (
    <a
      href={`/sensors/${sensor.id}`}
      className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2 hover:bg-muted/60 hover:border-border transition-colors no-underline group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          <span className="text-xs font-medium text-muted-foreground capitalize group-hover:text-foreground transition-colors">
            {sensor.type ?? "Sensor"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {latest !== undefined && (
            <span className="text-sm font-semibold tabular-nums">
              {typeof latest === "number" ? latest.toFixed(1) : latest}
              {sensor.unit && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {sensor.unit}
                </span>
              )}
            </span>
          )}
          <span className="text-muted-foreground/40 text-xs opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
        </div>
      </div>
      {readings.length > 1 ? (
        <Sparkline values={readings} color={color} />
      ) : (
        <p className="text-xs text-muted-foreground">No readings yet</p>
      )}
    </a>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className="text-xs font-medium ml-auto text-right break-all">{value}</span>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────
export function DeviceDetail({ device, onClose, onViewOnMap }: DeviceDetailProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // Sync open state to device presence with animation timing
  useEffect(() => {
    if (device) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    } else {
      setOpen(false);
    }
  }, [device]);

  const handleTransitionEnd = () => {
    if (!open) setMounted(false);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 300);
  };

  if (!mounted || !device) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity duration-300"
        style={{ opacity: open ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Slide-over panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-background border-l shadow-xl overflow-y-auto transition-transform duration-300 ease-[cubic-bezier(0.32,0,0.15,1)]"
        style={{
          width: "min(440px, 96vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b sticky top-0 bg-background z-10">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-[15px] leading-snug">{device.name}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <DeviceStatusBadge status={device.status} />
                <span className="text-xs text-muted-foreground">{device.type}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-6 p-5 flex-1">

          {/* Location + View on map */}
          <div className="rounded-lg border bg-muted/30 p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Location
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground">{device.zone.hospital.name}</span>
                <span className="text-muted-foreground/40 text-xs">›</span>
                <span className="text-xs font-semibold">{device.zone.name}</span>
              </div>
            </div>
            {onViewOnMap && (
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 gap-1.5 h-8 text-xs"
                onClick={() => onViewOnMap(device)}
              >
                <Map className="h-3.5 w-3.5" />
                View on map
              </Button>
            )}
          </div>

          {/* Device info */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Device info
            </p>
            <div className="rounded-lg border bg-muted/30 px-3">
              <InfoRow icon={Hash}  label="Device ID"  value={device.id} />
              <InfoRow icon={Cpu}   label="Firmware"   value={device.firmware} />
              <InfoRow icon={Wifi}  label="IP Address" value={device.ipAddress} />
              <InfoRow
                icon={Clock}
                label="Last seen"
                value={device.lastSeen ? new Date(device.lastSeen).toLocaleString() : undefined}
              />
            </div>
          </div>

          {/* Sensors */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Sensors · {device.sensors.length}
            </p>
            {device.sensors.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {device.sensors.map((s) => (
                  <SensorCard key={s.id} sensor={s} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No sensors attached
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}