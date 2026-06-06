"use client";

import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceDot,
} from "recharts";
import { format } from "date-fns";

interface ThresholdLine {
  value: number;
  label: string;
  severity: string;
  condition: string; // "ABOVE" | "BELOW"
}

interface SensorChartProps {
  readings: { value: number; timestamp: string }[];
  unit: string;
  sensorName: string;
  thresholdLines?: ThresholdLine[];
  hasAlert?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH:     "#f97316",
  MEDIUM:   "#eab308",
  LOW:      "#3b82f6",
};

const NORMAL_COLOR = "hsl(142, 76%, 36%)"; // green
const BREACH_COLOR = "#ef4444";            // red

export function SensorChart({
  readings,
  unit,
  sensorName,
  thresholdLines = [],
  hasAlert = false,
}: SensorChartProps) {
  if (readings.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available for the selected time range
      </div>
    );
  }

  // Find high and low thresholds from rules
  const highThreshold = thresholdLines.find((t) => t.condition === "ABOVE")?.value ?? Infinity;
  const lowThreshold  = thresholdLines.find((t) => t.condition === "BELOW")?.value ?? -Infinity;

  // For each reading, split into normal / breach values so Recharts
  // can render them as separate colored areas
  const data = readings.map((r) => {
    const v       = r.value;
    const isHigh  = v > highThreshold;
    const isLow   = v < lowThreshold;
    const isBreach = isHigh || isLow;
    return {
      time:        format(new Date(r.timestamp), "MMM dd HH:mm"),
      fullTime:    new Date(r.timestamp).toLocaleString(),
      value:       v,
      normal:      isBreach ? null : v,   // null = gap in area
      breach:      isBreach ? v    : null,
    };
  });

  const latestPoint = data[data.length - 1];
  const latestValue = latestPoint?.value;
  const latestIsBreach =
    latestValue !== undefined &&
    (latestValue > highThreshold || latestValue < lowThreshold);

  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradNormal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={NORMAL_COLOR} stopOpacity={0.25} />
            <stop offset="95%" stopColor={NORMAL_COLOR} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradBreach" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={BREACH_COLOR} stopOpacity={0.3} />
            <stop offset="95%" stopColor={BREACH_COLOR} stopOpacity={0.05} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

        <XAxis
          dataKey="time"
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          label={{ value: unit, angle: -90, position: "insideLeft", fontSize: 11 }}
        />

        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const pt      = payload[0].payload;
            const val     = pt.value;
            const breach  = val > highThreshold || val < lowThreshold;
            return (
              <div className="rounded-lg border bg-background p-2 shadow-md min-w-[140px]">
                <p className="text-xs text-muted-foreground">{pt.fullTime}</p>
                <p className={`text-sm font-bold mt-1 ${breach ? "text-red-600" : "text-green-700"}`}>
                  {Number(val).toFixed(2)} {unit}
                </p>
                {breach && (
                  <p className="text-xs text-red-500 mt-0.5">
                    ⚠ Outside threshold
                  </p>
                )}
              </div>
            );
          }}
        />

        {/* Threshold reference lines */}
        {thresholdLines.map((t, i) => (
          <ReferenceLine
            key={i}
            y={t.value}
            stroke={SEVERITY_COLORS[t.severity] ?? "#94a3b8"}
            strokeDasharray="5 3"
            strokeWidth={1.5}
            label={{
              value:    `${t.label} (${t.value}${unit})`,
              position: t.condition === "ABOVE" ? "insideTopRight" : "insideBottomRight",
              fontSize: 10,
              fill:     SEVERITY_COLORS[t.severity] ?? "#94a3b8",
            }}
          />
        ))}

        {/* Normal area — green */}
        <Area
          type="monotone"
          dataKey="normal"
          stroke={NORMAL_COLOR}
          fill="url(#gradNormal)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />

        {/* Breach area — red */}
        <Area
          type="monotone"
          dataKey="breach"
          stroke={BREACH_COLOR}
          fill="url(#gradBreach)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />

        {/* Current reading dot */}
        {latestPoint && (
          <ReferenceDot
            x={latestPoint.time}
            y={latestValue}
            r={5}
            fill={latestIsBreach ? BREACH_COLOR : NORMAL_COLOR}
            stroke="white"
            strokeWidth={2}
            label={{
              value:    `Now: ${latestValue?.toFixed(1)}${unit}`,
              position: "top",
              fontSize: 10,
              fill:     latestIsBreach ? BREACH_COLOR : NORMAL_COLOR,
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}