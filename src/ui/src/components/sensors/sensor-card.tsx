"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface SensorCardProps {
  sensor: {
    id: string;
    name: string;
    type: string;
    unit: string;
    device: {
      name: string;
      zone: { name: string; hospital: { name: string } };
    };
    readings: { value: number; timestamp: string }[];
  };
}

const TYPE_COLORS: Record<string, string> = {
  TEMPERATURE:   "text-orange-500",
  HUMIDITY:      "text-blue-500",
  SOIL_MOISTURE: "text-green-500",
  LIGHT:         "text-yellow-500",
  CO2:           "text-purple-500",
};

const TYPE_BG: Record<string, string> = {
  TEMPERATURE:   "bg-orange-50 border-orange-100",
  HUMIDITY:      "bg-blue-50 border-blue-100",
  SOIL_MOISTURE: "bg-green-50 border-green-100",
  LIGHT:         "bg-yellow-50 border-yellow-100",
  CO2:           "bg-purple-50 border-purple-100",
};

interface ActiveAlert {
  id: string;
  severity: string;
  message: string;
}

export function SensorCard({ sensor }: SensorCardProps) {
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);

  const latestReading = sensor.readings?.[sensor.readings.length - 1];
  const latestValue   = latestReading?.value;

  useEffect(() => {
    // Fetch active alerts for this specific sensor
    fetch(`/api/alerts?sensorId=${sensor.id}&acknowledged=false&limit=5`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.alerts ?? []);
        setAlerts(list.filter((a: any) => !a.acknowledged));
      })
      .catch(() => {});
  }, [sensor.id]);

  const hasCritical = alerts.some((a) => a.severity === "CRITICAL");
  const hasHigh     = alerts.some((a) => a.severity === "HIGH");
  const hasAlert    = alerts.length > 0;
  const worstAlert  = hasCritical ? "CRITICAL" : hasHigh ? "HIGH" : alerts[0]?.severity;

  const alertBorderClass = hasCritical
    ? "border-red-400 ring-1 ring-red-300"
    : hasHigh
    ? "border-orange-400 ring-1 ring-orange-300"
    : hasAlert
    ? "border-yellow-400"
    : "";

  return (
    <Link href={`/sensors/${sensor.id}`} className="block group">
      <Card className={`transition-all hover:shadow-md ${alertBorderClass} ${hasAlert ? "" : TYPE_BG[sensor.type] ?? ""}`}>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{sensor.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {sensor.device.zone.hospital.name} · {sensor.device.name}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {hasAlert && (
                <span className={`flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded ${
                  hasCritical ? "bg-red-100 text-red-700" :
                  hasHigh     ? "bg-orange-100 text-orange-700" :
                                "bg-yellow-100 text-yellow-700"
                }`}>
                  <AlertTriangle className="h-3 w-3" />
                  {worstAlert}
                </span>
              )}
              <Badge variant="outline" className={`text-xs ${TYPE_COLORS[sensor.type] ?? ""}`}>
                {sensor.type.replace("_", " ")}
              </Badge>
            </div>
          </div>

          {/* Value */}
          <div className={`text-2xl font-bold tabular-nums ${
            hasCritical ? "text-red-600" :
            hasHigh     ? "text-orange-600" :
                          (TYPE_COLORS[sensor.type] ?? "text-foreground")
          }`}>
            {latestValue !== undefined ? latestValue.toFixed(1) : "—"}
            <span className="text-sm font-normal text-muted-foreground ml-1">{sensor.unit}</span>
          </div>

          {/* Alert messages */}
          {hasAlert && (
            <div className="space-y-1">
              {alerts.slice(0, 2).map((alert) => (
                <p key={alert.id} className={`text-xs rounded px-2 py-1 ${
                  alert.severity === "CRITICAL" ? "bg-red-50 text-red-700" :
                  alert.severity === "HIGH"     ? "bg-orange-50 text-orange-700" :
                                                  "bg-yellow-50 text-yellow-700"
                }`}>
                  {alert.message}
                </p>
              ))}
            </div>
          )}

          {/* Location */}
          <p className="text-xs text-muted-foreground truncate">
            {sensor.device.zone.name}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}