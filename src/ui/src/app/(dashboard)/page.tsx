"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Warehouse, Cpu, Bell, Activity, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { AlertBanner } from "@/components/alerts/alert-banner";
import { SensorCard } from "@/components/sensors/sensor-card";
import { formatDistanceToNow } from "date-fns";

interface DashboardData {
  hospitals:      number;
  devices:        number;
  onlineDevices:  number;
  activeAlerts:   number;
  totalSensors:   number;
  previewSensors: any[];
  recentAlerts:   any[];
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH:     "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW:      "bg-blue-100 text-blue-700 border-blue-200",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    hospitals:      0,
    devices:        0,
    onlineDevices:  0,
    activeAlerts:   0,
    totalSensors:   0,
    previewSensors: [],
    recentAlerts:   [],
  });
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  async function loadData() {
    const [hospitals, devicesRes, activeAlertsRes, sensorsRes, recentAlertsRes] =
      await Promise.all([
        fetch("/api/hospitals").then((r) => r.json()),
        fetch("/api/devices?page=1&limit=1").then((r) => r.json()),
        fetch("/api/alerts?acknowledged=false&limit=100").then((r) => r.json()),
        fetch("/api/sensors?page=1&limit=8").then((r) => r.json()),
        fetch("/api/alerts?limit=5").then((r) => r.json()),
      ]);

    const activeList  = Array.isArray(activeAlertsRes)  ? activeAlertsRes  : (activeAlertsRes.alerts  ?? []);
    const recentList  = Array.isArray(recentAlertsRes)  ? recentAlertsRes  : (recentAlertsRes.alerts  ?? []);

    setData({
      hospitals:      Array.isArray(hospitals) ? hospitals.length : 0,
      devices:        devicesRes.total         ?? 0,
      onlineDevices:  devicesRes.onlineCount   ?? 0,
      activeAlerts:   activeList.length,
      totalSensors:   sensorsRes.total         ?? 0,
      previewSensors: sensorsRes.sensors       ?? [],
      recentAlerts:   recentList,
    });
  }

  useEffect(() => { loadData(); }, []);

  async function handleAcknowledge(alertId: string) {
    setAcknowledging(alertId);
    await fetch("/api/alerts", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: alertId, acknowledged: true }),
    });
    setAcknowledging(null);
    loadData();
  }

  const criticalAlerts = data.recentAlerts.filter(
    (a) => !a.acknowledged && (a.severity === "CRITICAL" || a.severity === "HIGH")
  );
  const otherAlerts = data.recentAlerts.filter(
    (a) => !a.acknowledged && a.severity !== "CRITICAL" && a.severity !== "HIGH"
  );

  return (
    <div className="space-y-6">
      <AlertBanner />

      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Hospital monitoring overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/hospitals">
          <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hospitals</CardTitle>
              <Warehouse className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.hospitals}</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/devices">
          <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Devices</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.devices}</div>
              {data.onlineDevices > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-green-600 font-medium">{data.onlineDevices}</span> online
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/alerts">
          <Card className={`hover:bg-muted/30 transition-colors cursor-pointer ${data.activeAlerts > 0 ? "border-red-200" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <Bell className={`h-4 w-4 ${data.activeAlerts > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.activeAlerts > 0 ? "text-red-600" : ""}`}>
                {data.activeAlerts}
              </div>
              {criticalAlerts.length > 0 && (
                <p className="text-xs text-red-500 mt-1 font-medium">
                  {criticalAlerts.length} critical/high
                </p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/sensors">
          <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sensors</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalSensors}</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Critical alerts — shown prominently if any */}
      {criticalAlerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Requires Attention
            </h2>
            <Link href="/alerts" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {criticalAlerts.slice(0, 3).map((alert: any) => (
            <div
              key={alert.id}
              className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 ${
                alert.severity === "CRITICAL"
                  ? "bg-red-50 border-red-200"
                  : "bg-orange-50 border-orange-200"
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  alert.severity === "CRITICAL" ? "text-red-500" : "text-orange-500"
                }`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[alert.severity]}`}>
                      {alert.severity}
                    </span>
                    <span className="text-sm font-medium truncate">{alert.message}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {alert.sensor?.name} · triggered at <strong>{alert.value?.toFixed(2)}</strong> (threshold: {alert.threshold}) · {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 h-7 text-xs gap-1"
                disabled={acknowledging === alert.id}
                onClick={() => handleAcknowledge(alert.id)}
              >
                <CheckCircle className="h-3 w-3" />
                {acknowledging === alert.id ? "..." : "Ack"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Recent alerts table */}
      {data.recentAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Alerts</CardTitle>
              <Link href="/alerts" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentAlerts.slice(0, 5).map((alert: any) => (
                <div key={alert.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      variant={
                        alert.severity === "CRITICAL" || alert.severity === "HIGH"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {alert.severity}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.sensor?.name} ·{" "}
                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  {alert.acknowledged ? (
                    <span className="text-xs text-muted-foreground flex-shrink-0">Acknowledged</span>
                  ) : (
                    <span className="text-xs text-orange-600 font-medium flex-shrink-0">Active</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sensor preview */}
      {data.previewSensors.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              Sensor Readings
              {data.totalSensors > 8 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  showing 8 of {data.totalSensors}
                </span>
              )}
            </h2>
            <Link href="/sensors" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.previewSensors.map((sensor: any) => (
              <SensorCard key={sensor.id} sensor={sensor} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}