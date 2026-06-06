"use client";

import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

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

interface Props {
  stats: SensorStat[];
  selectedId?: string;
  onSelect: (s: SensorStat) => void;
}

const TYPE_COLORS: Record<string, string> = {
  TEMPERATURE:    "bg-orange-100 text-orange-800",
  HUMIDITY:       "bg-blue-100 text-blue-800",
  SOIL_MOISTURE:  "bg-green-100 text-green-800",
  LIGHT:          "bg-yellow-100 text-yellow-800",
  CO2:            "bg-purple-100 text-purple-800",
};

export function SensorStatTable({ stats, selectedId, onSelect }: Props) {
  if (stats.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground rounded-lg border">
        No sensor data for the selected period.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <p className="text-sm font-medium">Sensors · {stats.length}</p>
        <p className="text-xs text-muted-foreground">Click a row to view trend</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sensor</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Readings</TableHead>
            <TableHead className="text-right">Min</TableHead>
            <TableHead className="text-right">Avg</TableHead>
            <TableHead className="text-right">Max</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((s) => (
            <TableRow
              key={s.sensorId}
              className={`cursor-pointer transition-colors ${
                selectedId === s.sensorId
                  ? "bg-muted"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => onSelect(s)}
            >
              <TableCell className="font-medium">{s.sensorName}</TableCell>
              <TableCell>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  TYPE_COLORS[s.sensorType] ?? "bg-muted text-muted-foreground"
                }`}>
                  {s.sensorType.replace("_", " ")}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {s.count.toLocaleString()}
              </TableCell>
              <TableCell className="text-right tabular-nums text-blue-600">
                {s.min.toFixed(1)} <span className="text-muted-foreground text-xs">{s.unit}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {s.avg.toFixed(1)} <span className="text-muted-foreground text-xs">{s.unit}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums text-red-600">
                {s.max.toFixed(1)} <span className="text-muted-foreground text-xs">{s.unit}</span>
              </TableCell>
              <TableCell>
                <TrendingUp className={`h-3.5 w-3.5 ${
                  selectedId === s.sensorId ? "text-primary" : "text-muted-foreground/40"
                }`} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}