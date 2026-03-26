import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Heart, 
  Droplets, 
  Zap, 
  Wind, 
  Thermometer, 
  Gauge,
  Brain,
  Activity
} from "lucide-react";
import { type LucideIcon } from "lucide-react";

const sensorIcons: Record<string, LucideIcon> = {
  HEART_RATE: Heart,
  SPO2_LEVEL: Droplets,
  ECG_SIGNAL: Zap,
  RESPIRATION_RATE: Wind,
  BODY_TEMPERATURE: Thermometer,
  BLOOD_PRESSURE_SYS: Gauge,
  BLOOD_PRESSURE_DIA: Gauge,
  BLOOD_GLUCOSE: Activity,
  EEG_ALPHA_POWER: Brain,
  EEG_BETA_POWER: Brain,
  EMG_SIGNAL_STRENGTH: Activity,
  TEMPERATURE: Thermometer,
  HUMIDITY: Droplets,
  SOIL_MOISTURE: Activity,
  LIGHT: Zap,
  CO2: Wind,
};

const sensorConfig: Record<string, { bgColor: string; textColor: string; borderColor: string }> = {
  HEART_RATE: { bgColor: "bg-red-50", textColor: "text-red-600", borderColor: "border-red-200" },
  SPO2_LEVEL: { bgColor: "bg-blue-50", textColor: "text-blue-600", borderColor: "border-blue-200" },
  ECG_SIGNAL: { bgColor: "bg-purple-50", textColor: "text-purple-600", borderColor: "border-purple-200" },
  RESPIRATION_RATE: { bgColor: "bg-cyan-50", textColor: "text-cyan-600", borderColor: "border-cyan-200" },
  BODY_TEMPERATURE: { bgColor: "bg-orange-50", textColor: "text-orange-600", borderColor: "border-orange-200" },
  BLOOD_PRESSURE_SYS: { bgColor: "bg-rose-50", textColor: "text-rose-600", borderColor: "border-rose-200" },
  BLOOD_PRESSURE_DIA: { bgColor: "bg-pink-50", textColor: "text-pink-600", borderColor: "border-pink-200" },
  BLOOD_GLUCOSE: { bgColor: "bg-amber-50", textColor: "text-amber-600", borderColor: "border-amber-200" },
  EEG_ALPHA_POWER: { bgColor: "bg-indigo-50", textColor: "text-indigo-600", borderColor: "border-indigo-200" },
  EEG_BETA_POWER: { bgColor: "bg-violet-50", textColor: "text-violet-600", borderColor: "border-violet-200" },
  EMG_SIGNAL_STRENGTH: { bgColor: "bg-lime-50", textColor: "text-lime-600", borderColor: "border-lime-200" },
  TEMPERATURE: { bgColor: "bg-red-50", textColor: "text-red-600", borderColor: "border-red-200" },
  HUMIDITY: { bgColor: "bg-blue-50", textColor: "text-blue-600", borderColor: "border-blue-200" },
  SOIL_MOISTURE: { bgColor: "bg-green-50", textColor: "text-green-600", borderColor: "border-green-200" },
  LIGHT: { bgColor: "bg-yellow-50", textColor: "text-yellow-600", borderColor: "border-yellow-200" },
  CO2: { bgColor: "bg-slate-50", textColor: "text-slate-600", borderColor: "border-slate-200" },
};

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

export function SensorCard({ sensor }: SensorCardProps) {
  const Icon = sensorIcons[sensor.type] || Thermometer;
  const config = sensorConfig[sensor.type] || sensorConfig.TEMPERATURE;
  const latestReading = sensor.readings[0];

  return (
    <Link href={`/sensors/${sensor.id}`}>
      <Card className={`hover:shadow-lg transition-all cursor-pointer border-2 ${config.bgColor} ${config.borderColor}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{sensor.name}</CardTitle>
            <Icon className={`h-5 w-5 ${config.textColor}`} />
          </div>
          <p className="text-xs text-muted-foreground">
            {sensor.device.zone.hospital.name} / {sensor.device.zone.name}
          </p>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${config.textColor}`}>
            {latestReading
              ? `${latestReading.value.toFixed(1)} ${sensor.unit}`
              : "No data"}
          </div>
          {latestReading && (
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(latestReading.timestamp).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
