"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";

interface SensorStat {
  sensorId: string;
  sensorName: string;
  sensorType: string;
  unit: string;
  min: number;
  max: number;
  avg: number;
}

interface Props {
  sensor: SensorStat;
  readings: { value: number; timestamp: string }[];
  loading: boolean;
  onClose: () => void;
}

const TYPE_COLOR: Record<string, string> = {
  TEMPERATURE:   "#f97316",
  HUMIDITY:      "#3b82f6",
  SOIL_MOISTURE: "#22c55e",
  LIGHT:         "#eab308",
  CO2:           "#8b5cf6",
};

export function DrillDownChart({ sensor, readings, loading, onClose }: Props) {
  const color = TYPE_COLOR[sensor.sensorType] ?? "#6b7280";

  const chartData = readings.map((r) => ({
    time:  format(new Date(r.timestamp), "MMM dd HH:mm"),
    value: r.value,
  }));

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base">{sensor.sensorName}</CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sensor.sensorType.replace("_", " ")} · {sensor.unit}
            {!loading && readings.length > 0 && (
              <span className="ml-2 text-xs">
                {readings.length} readings
              </span>
            )}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading readings…</span>
          </div>
        ) : readings.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            No readings in this period
          </div>
        ) : (
          <>
            {/* Mini stat row */}
            <div className="grid grid-cols-3 gap-4 mb-4 px-1">
              {[
                { label: "Min", value: sensor.min, color: "text-blue-600" },
                { label: "Avg", value: sensor.avg, color: "text-foreground" },
                { label: "Max", value: sensor.max, color: "text-red-600" },
              ].map(({ label, value, color: c }) => (
                <div key={label} className="text-center">
                  <p className={`text-lg font-bold tabular-nums ${c}`}>
                    {value.toFixed(1)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">{sensor.unit}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => v != null ? [`${Number(v).toFixed(2)} ${sensor.unit}`, sensor.sensorName] : ["—", sensor.sensorName]}
                />
                <ReferenceLine y={sensor.avg} stroke={color} strokeDasharray="4 4" opacity={0.5} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}