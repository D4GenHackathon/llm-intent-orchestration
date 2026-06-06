"use client";

import { useEffect, useState, useCallback } from "react";
import { StatsCards } from "@/components/analytics/stats-cards";
import { DateRangePicker } from "@/components/analytics/date-range-picker";
import { ExportButton } from "@/components/analytics/export-button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import dynamic from "next/dynamic";

const DrillDownChart = dynamic(
  () => import("@/components/analytics/drill-down-chart").then(m => ({ default: m.DrillDownChart })),
  { ssr: false }
);
const SensorStatTable = dynamic(
  () => import("@/components/analytics/sensor-stat-table").then(m => ({ default: m.SensorStatTable })),
  { ssr: false }
);
interface SensorStat {
  sensorId: string;
  sensorName: string;
  sensorType: string;
  unit: string;
  count: number;
  min: number;
  max: number;
  avg: number;
}

export default function AnalyticsPage() {
  const [stats,         setStats]         = useState<SensorStat[]>([]);
  const [totalReadings, setTotalReadings] = useState(0);
  const [hours,         setHours]         = useState(168);
  const [sensorType,    setSensorType]    = useState("all");
  const [selectedSensor, setSelectedSensor] = useState<SensorStat | null>(null);
  const [drillData,     setDrillData]     = useState<{ value: number; timestamp: string }[]>([]);
  const [drillLoading,  setDrillLoading]  = useState(false);

  // Load summary stats (fast — no readings)
  useEffect(() => {
    const params = new URLSearchParams({ hours: hours.toString() });
    if (sensorType !== "all") params.set("sensorType", sensorType);
    fetch(`/api/analytics?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats ?? []);
        setTotalReadings(data.totalReadings ?? 0);
        setSelectedSensor(null);
        setDrillData([]);
      });
  }, [hours, sensorType]);

  // Load readings for selected sensor
  const loadDrillDown = useCallback(async (sensor: SensorStat) => {
    setSelectedSensor(sensor);
    setDrillLoading(true);
    const params = new URLSearchParams({
      hours:    hours.toString(),
      sensorId: sensor.sensorId,
    });
    const data = await fetch(`/api/analytics?${params}`).then((r) => r.json());
    setDrillData(data.readings ?? []);
    setDrillLoading(false);
  }, [hours]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Sensor data trends and statistics</p>
        </div>
        <ExportButton hours={hours} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <DateRangePicker hours={hours} onChange={(h) => { setHours(h); setSelectedSensor(null); }} />
        <Select value={sensorType} onValueChange={(v) => { setSensorType(v); setSelectedSensor(null); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All sensor types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="TEMPERATURE">Temperature</SelectItem>
            <SelectItem value="HUMIDITY">Humidity</SelectItem>
            <SelectItem value="SOIL_MOISTURE">Soil Moisture</SelectItem>
            <SelectItem value="LIGHT">Light</SelectItem>
            <SelectItem value="CO2">CO2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary stats */}
      <StatsCards stats={stats} totalReadings={totalReadings} />

      {/* Drill-down chart — shown when a sensor is selected */}
      {selectedSensor && (
        <DrillDownChart
          sensor={selectedSensor}
          readings={drillData}
          loading={drillLoading}
          onClose={() => { setSelectedSensor(null); setDrillData([]); }}
        />
      )}

      {/* Sensor table — click a row to drill down */}
      <SensorStatTable
        stats={stats}
        selectedId={selectedSensor?.sensorId}
        onSelect={loadDrillDown}
      />
    </div>
  );
}