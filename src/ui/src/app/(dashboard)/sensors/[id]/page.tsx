"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SensorChart } from "@/components/sensors/sensor-chart";

interface Sensor {
  id: string;
  name: string;
  type: string;
  unit: string;
  minValue: number | null;
  maxValue: number | null;
  device: {
    name: string;
    zone: { name: string; hospital: { name: string } };
  };
  alertRules: {
    id: string;
    name: string;
    condition: string;
    threshold: number;
    severity: string;
    enabled: boolean;
  }[];
}

interface Reading {
  id: string;
  value: number;
  timestamp: string;
}

interface ActiveAlert {
  id: string;
  message: string;
  severity: string;
  value: number;
  threshold: number;
  createdAt: string;
  acknowledged: boolean;
}

const SEVERITY_STYLES: Record<string, { banner: string; badge: string }> = {
  CRITICAL: {
    banner: "bg-red-50 border-red-300 text-red-800",
    badge:  "bg-red-100 text-red-700 border-red-200",
  },
  HIGH: {
    banner: "bg-orange-50 border-orange-300 text-orange-800",
    badge:  "bg-orange-100 text-orange-700 border-orange-200",
  },
  MEDIUM: {
    banner: "bg-yellow-50 border-yellow-300 text-yellow-800",
    badge:  "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  LOW: {
    banner: "bg-blue-50 border-blue-300 text-blue-800",
    badge:  "bg-blue-100 text-blue-700 border-blue-200",
  },
};

export default function SensorDetailPage() {
  const params = useParams();
  const [sensor,        setSensor]        = useState<Sensor | null>(null);
  const [readings,      setReadings]      = useState<Reading[]>([]);
  const [activeAlerts,  setActiveAlerts]  = useState<ActiveAlert[]>([]);
  const [hours,         setHours]         = useState(24);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sensors/${params.id}`)
      .then((r) => r.json())
      .then(setSensor);
  }, [params.id]);

  useEffect(() => {
    fetch(`/api/sensors/${params.id}/readings?hours=${hours}`)
      .then((r) => r.json())
      .then(setReadings);
  }, [params.id, hours]);

  // Fetch active alerts for this sensor
  function loadAlerts() {
    fetch(`/api/alerts?sensorId=${params.id}&acknowledged=false&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.alerts ?? []);
        setActiveAlerts(list);
      });
  }

  useEffect(() => { loadAlerts(); }, [params.id]);

  async function handleAcknowledge(alertId: string) {
    setAcknowledging(alertId);
    await fetch("/api/alerts", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: alertId, acknowledged: true }),
    });
    setAcknowledging(null);
    loadAlerts();
  }

  if (!sensor) return <div className="p-6">Loading...</div>;

  const latestReading  = readings[readings.length - 1];
  const worstSeverity  = activeAlerts.find((a) => a.severity === "CRITICAL")?.severity
    ?? activeAlerts.find((a) => a.severity === "HIGH")?.severity
    ?? activeAlerts[0]?.severity;
  const hasActiveAlert = activeAlerts.length > 0;

  // Threshold lines for chart — from enabled alert rules
  const thresholdLines = sensor.alertRules
    .filter((r) => r.enabled)
    .map((r) => ({ value: r.threshold, label: r.name, severity: r.severity, condition: r.condition }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/sensors">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{sensor.name}</h1>
            {hasActiveAlert && (
              <AlertTriangle className={`h-5 w-5 ${
                worstSeverity === "CRITICAL" ? "text-red-500" :
                worstSeverity === "HIGH"     ? "text-orange-500" :
                                               "text-yellow-500"
              }`} />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {sensor.device.zone.hospital.name} / {sensor.device.zone.name} / {sensor.device.name}
          </p>
        </div>
      </div>

      {/* Active alert banners */}
      {activeAlerts.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.LOW;
        return (
          <div
            key={alert.id}
            className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 ${style.banner}`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${style.badge}`}>
                    {alert.severity}
                  </span>
                  <span className="text-sm font-medium">{alert.message}</span>
                </div>
                <p className="text-xs mt-0.5 opacity-75">
                  Triggered at: <strong>{alert.value.toFixed(2)} {sensor.unit}</strong> · Threshold: {alert.threshold} {sensor.unit} · {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
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
              {acknowledging === alert.id ? "..." : "Acknowledge"}
            </Button>
          </div>
        );
      })}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={hasActiveAlert ? "border-red-200" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current Reading
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${
              worstSeverity === "CRITICAL" ? "text-red-600" :
              worstSeverity === "HIGH"     ? "text-orange-600" :
                                             ""
            }`}>
              {latestReading ? `${latestReading.value.toFixed(1)} ${sensor.unit}` : "N/A"}
            </div>
            {hasActiveAlert && (
              <p className="text-xs text-red-500 mt-1">{activeAlerts.length} active alert{activeAlerts.length > 1 ? "s" : ""}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sensor Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{sensor.type.replace("_", " ")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Readings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{readings.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Historical Data</CardTitle>
            <div className="flex gap-2">
              {[6, 12, 24, 48, 168].map((h) => (
                <Button
                  key={h}
                  variant={hours === h ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHours(h)}
                >
                  {h < 24 ? `${h}h` : `${h / 24}d`}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SensorChart
            readings={readings}
            unit={sensor.unit}
            sensorName={sensor.name}
            thresholdLines={thresholdLines}
            hasAlert={hasActiveAlert}
          />
        </CardContent>
      </Card>

      {/* Alert rules */}
      {sensor.alertRules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alert Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sensor.alertRules.map((rule) => {
                const isTriggered = activeAlerts.some(
                  (a) => Math.abs(a.threshold - rule.threshold) < 0.01
                );
                return (
                  <div
                    key={rule.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      isTriggered ? "border-red-200 bg-red-50" : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{rule.name}</p>
                        {isTriggered && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                            Triggered
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {rule.condition} {rule.threshold} {sensor.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.enabled ? "default" : "secondary"}>
                        {rule.enabled ? "Active" : "Disabled"}
                      </Badge>
                      <span className={`text-xs px-2 py-1 rounded ${
                        rule.severity === "CRITICAL" ? "bg-red-100 text-red-700" :
                        rule.severity === "HIGH"     ? "bg-orange-100 text-orange-700" :
                        rule.severity === "MEDIUM"   ? "bg-yellow-100 text-yellow-700" :
                                                       "bg-blue-100 text-blue-700"
                      }`}>
                        {rule.severity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}