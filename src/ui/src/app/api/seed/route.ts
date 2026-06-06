import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Clear existing data
    await prisma.alert.deleteMany();
    await prisma.alertRule.deleteMany();
    await prisma.sensorReading.deleteMany();
    await prisma.sensor.deleteMany();
    await prisma.device.deleteMany();
    await prisma.zone.deleteMany();
    await prisma.hospital.deleteMany();
    await prisma.user.deleteMany();

    const hashedPassword = await bcrypt.hash("password123", 10);
    await prisma.user.create({
      data: {
        email: "admin@hospital.io",
        name: "Admin User",
        password: hashedPassword,
        role: "ADMIN",
      },
    });

    const sensorConfigs = [
      { type: "HEART_RATE",         unit: "bpm",        min: 50,  max: 120, base: 75  },
      { type: "SPO2_LEVEL",         unit: "%",           min: 90,  max: 100, base: 98  },
      { type: "ECG_SIGNAL",         unit: "mV",          min: -1,  max: 5,   base: 0.5 },
      { type: "RESPIRATION_RATE",   unit: "breaths/min", min: 12,  max: 25,  base: 16  },
      { type: "BODY_TEMPERATURE",   unit: "°C",          min: 35,  max: 40,  base: 37  },
      { type: "BLOOD_PRESSURE_SYS", unit: "mmHg",        min: 90,  max: 180, base: 120 },
      { type: "BLOOD_PRESSURE_DIA", unit: "mmHg",        min: 50,  max: 110, base: 80  },
      { type: "BLOOD_GLUCOSE",      unit: "mg/dL",       min: 70,  max: 200, base: 100 },
    ];

    const hospitals = [
      {
        name: "Main Hospital",
        location: "Building A, North Wing",
        description: "Primary medical facility for patient care",
        floors: [
          {
            label: "Ground Floor",
            zones: ["Reception & Triage","Emergency - Trauma","Emergency - Resuscitation","Emergency - Observation","Radiology - CT Scan","Radiology - MRI","Radiology - X-Ray","Pharmacy & Dispensary"],
          },
          {
            label: "Floor 1",
            zones: ["ICU - Intensive Care A","ICU - Intensive Care B","ICU - Cardiac Care","ICU - Neonatal","Cardiology - Heart","Cardiology - Catheterization","Pulmonology - Lungs","Pulmonology - Respiratory"],
          },
          {
            label: "Floor 2",
            zones: ["Neurology - Brain","Neurology - Stroke Unit","Orthopedics - Bones","Orthopedics - Spine","Oncology - Chemotherapy","Oncology - Radiation","Pediatrics - Neonatal","Pediatrics - General"],
          },
          {
            label: "Floor 3",
            zones: ["Surgery - Operating Room A","Surgery - Operating Room B","Surgery - Operating Room C","Surgery - Recovery","General - Ward A","General - Ward B","General - Ward C","Maternity - Labor & Delivery"],
          },
        ],
      },
      {
        name: "Research Hospital",
        location: "Building B, East Side",
        description: "Experimental treatments and research facility",
        floors: [
          {
            label: "Ground Floor",
            zones: ["Admissions & Reception","Pathology - Specimens","Pathology - Histology","Microbiology Lab A","Microbiology Lab B","Biobank Storage","Clinical Assessment","Outpatient - Clinic A"],
          },
          {
            label: "Floor 1",
            zones: ["Clinical Trials - Unit A","Clinical Trials - Unit B","Clinical Trials - Unit C","Genomics Lab","Genomics - Sequencing","Immunology - Research","Immunology - Cell Lab","Proteomics Lab"],
          },
          {
            label: "Floor 2",
            zones: ["Neuroscience Lab A","Neuroscience Lab B","Cardio Research","Cardio - Stress Testing","Rehabilitation - Physio A","Rehabilitation - Physio B","Recovery - General","Stem Cell Research"],
          },
        ],
      },
    ];

    let globalDeviceIdx = 0;

    for (const hospData of hospitals) {
      const hospital = await prisma.hospital.create({
        data: {
          name: hospData.name,
          location: hospData.location,
          description: hospData.description,
        },
      });

      for (const floor of hospData.floors) {
        for (const zoneName of floor.zones) {
          const zone = await prisma.zone.create({
            data: {
              name: `${floor.label} – ${zoneName}`,
              description: `${zoneName} on ${floor.label}, ${hospData.name}`,
              hospitalId: hospital.id,
            },
          });

          for (let dIdx = 0; dIdx < 2; dIdx++) {
            const device = await prisma.device.create({
              data: {
                name: `ESP32 ${zoneName.split(" ")[0]}-${dIdx + 1}`,
                type: "ESP32",
                status: Math.random() > 0.1 ? "ONLINE" : "OFFLINE",
                zoneId: zone.id,
              },
            });

            const startIdx = (globalDeviceIdx * 4) % sensorConfigs.length;
            const deviceSensors = [0, 1, 2, 3].map(
              (i) => sensorConfigs[(startIdx + i) % sensorConfigs.length]
            );

            for (const config of deviceSensors) {
              const sensor = await prisma.sensor.create({
                data: {
                  name: `${config.type.replace(/_/g, " ")} – ${zoneName}`,
                  type: config.type,
                  unit: config.unit,
                  minValue: config.min,
                  maxValue: config.max,
                  deviceId: device.id,
                },
              });

              const highThreshold = config.max * 0.9;
              const lowThreshold  = config.min * 1.1;

              await prisma.alertRule.createMany({
                data: [
                  {
                    name: `${config.type} High – ${zoneName}`,
                    sensorId: sensor.id,
                    condition: "ABOVE",
                    threshold: highThreshold,
                    severity: "HIGH",
                    enabled: true,
                  },
                  {
                    name: `${config.type} Low – ${zoneName}`,
                    sensorId: sensor.id,
                    condition: "BELOW",
                    threshold: lowThreshold,
                    severity: "MEDIUM",
                    enabled: true,
                  },
                ],
              });

              // ── Generate readings with realistic spikes ──────────────────
              const now       = Date.now();
              const readings  = [];
              // Historical spikes spread across 30 days
              const historicalSpikeCount = 3 + Math.floor(Math.random() * 3);
              const historicalSpikes = Array.from({ length: historicalSpikeCount }, () => ({
                start:    Math.floor(Math.random() * 1380), // anywhere in first 1380 readings
                duration: 3 + Math.floor(Math.random() * 6),
                type:     Math.random() > 0.3 ? "high" : "low",
              }));
              // 1-2 recent spikes in the last 2h (last ~4 readings) — these become active alerts
              const recentSpikeCount = Math.random() > 0.5 ? 1 : 2;
              const recentSpikes = Array.from({ length: recentSpikeCount }, () => ({
                start:    1434 + Math.floor(Math.random() * 4), // last 4 readings (~2h)
                duration: 2 + Math.floor(Math.random() * 3),
                type:     Math.random() > 0.3 ? "high" : "low",
              }));
              const spikeWindows = [...historicalSpikes, ...recentSpikes];

              for (let i = 0; i < 1440; i++) {
                const timestamp  = new Date(now - (1440 - i) * 30 * 60 * 1000);
                const hourOfDay  = timestamp.getHours();
                const dayFactor  = Math.sin(((hourOfDay - 6) * Math.PI) / 12) * 0.3;
                const noise      = (Math.random() - 0.5) * (config.max - config.min) * 0.12;

                // Check if this reading falls in a spike window
                const spike = spikeWindows.find(
                  (s) => i >= s.start && i < s.start + s.duration
                );

                let value: number;
                if (spike) {
                  // Spike goes clearly above/below threshold
                  const spikeIntensity = 0.05 + Math.random() * 0.15; // 5-20% beyond threshold
                  if (spike.type === "high") {
                    value = highThreshold * (1 + spikeIntensity);
                    // Cap at 120% of max to keep realistic
                    value = Math.min(value, config.max * 1.2);
                  } else {
                    value = lowThreshold * (1 - spikeIntensity);
                    value = Math.max(value, config.min * 0.8);
                  }
                } else {
                  // Normal reading — stays safely within thresholds
                  const safeMax = highThreshold * 0.85;
                  const safeMin = lowThreshold  * 1.15;
                  value = config.base
                    + dayFactor * (config.max - config.min) * 0.2
                    + noise;
                  value = Math.max(safeMin, Math.min(safeMax, value));
                }

                readings.push({
                  sensorId:  sensor.id,
                  value:     Math.round(value * 100) / 100,
                  timestamp,
                });
              }

              // Bulk insert in chunks
              const chunkSize = 500;
              for (let i = 0; i < readings.length; i += chunkSize) {
                await prisma.sensorReading.createMany({
                  data: readings.slice(i, i + chunkSize),
                });
              }

              // ── Create alerts that match actual spike readings ────────────
              for (const spike of spikeWindows) {
                // Only create alert for ~60% of spikes (not all spikes get caught)
                if (Math.random() > 0.8) continue; // 80% of spikes generate an alert

                const spikeReadings = readings.slice(
                  spike.start,
                  spike.start + spike.duration
                );
                if (spikeReadings.length === 0) continue;

                // Pick the worst reading in the spike window as the alert value
                const worstReading = spikeReadings.reduce((worst, r) =>
                  spike.type === "high"
                    ? (r.value > worst.value ? r : worst)
                    : (r.value < worst.value ? r : worst)
                );

                const isHighSpike  = spike.type === "high";
                const threshold    = isHighSpike ? highThreshold : lowThreshold;
                const severity     = isHighSpike
                  ? (worstReading.value > config.max ? "CRITICAL" : "HIGH")
                  : "MEDIUM";

                await prisma.alert.create({
                  data: {
                    message: `${sensor.name}: value ${worstReading.value.toFixed(1)} ${config.unit} ${isHighSpike ? "exceeds" : "below"} threshold ${threshold.toFixed(1)} ${config.unit}`,
                    severity,
                    value:      worstReading.value,
                    threshold,
                    sensorId:   sensor.id,
                    // Recent alerts unacknowledged, older ones acknowledged
                    acknowledged: worstReading.timestamp < new Date(now - 60 * 60 * 1000), // active only if in last 1h
                    createdAt:    worstReading.timestamp,
                  },
                });
              }
            }

            globalDeviceIdx++;
          }
        }
      }
    }

    const totalZones   = hospitals.reduce((a, h) => a + h.floors.reduce((b, f) => b + f.zones.length, 0), 0);
    const totalDevices = totalZones * 2;
    const totalSensors = totalDevices * 4;

    return NextResponse.json({
      success: true,
      message: "Seed data created successfully",
      summary: {
        hospitals:     hospitals.length,
        totalZones,
        totalDevices,
        totalSensors,
        totalReadings: totalSensors * 1440,
      },
    });
  } catch (error) {
    console.error("🔥 SEED ERROR:", error);
    return NextResponse.json(
      {
        error:   "Failed to seed data",
        details: error instanceof Error ? error.message : String(error),
        stack:   error instanceof Error ? error.stack   : undefined,
      },
      { status: 500 }
    );
  }
}