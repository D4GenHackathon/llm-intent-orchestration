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

    // Create admin user
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
            zones: [
              "Reception & Triage",
              "Emergency - Trauma",
              "Emergency - Resuscitation",
              "Emergency - Observation",
              "Radiology - CT Scan",
              "Radiology - MRI",
              "Radiology - X-Ray",
              "Pharmacy & Dispensary",
            ],
          },
          {
            label: "Floor 1",
            zones: [
              "ICU - Intensive Care A",
              "ICU - Intensive Care B",
              "ICU - Cardiac Care",
              "ICU - Neonatal",
              "Cardiology - Heart",
              "Cardiology - Catheterization",
              "Pulmonology - Lungs",
              "Pulmonology - Respiratory",
            ],
          },
          {
            label: "Floor 2",
            zones: [
              "Neurology - Brain",
              "Neurology - Stroke Unit",
              "Orthopedics - Bones",
              "Orthopedics - Spine",
              "Oncology - Chemotherapy",
              "Oncology - Radiation",
              "Pediatrics - Neonatal",
              "Pediatrics - General",
            ],
          },
          {
            label: "Floor 3",
            zones: [
              "Surgery - Operating Room A",
              "Surgery - Operating Room B",
              "Surgery - Operating Room C",
              "Surgery - Recovery",
              "General - Ward A",
              "General - Ward B",
              "General - Ward C",
              "Maternity - Labor & Delivery",
            ],
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
            zones: [
              "Admissions & Reception",
              "Pathology - Specimens",
              "Pathology - Histology",
              "Microbiology Lab A",
              "Microbiology Lab B",
              "Biobank Storage",
              "Clinical Assessment",
              "Outpatient - Clinic A",
            ],
          },
          {
            label: "Floor 1",
            zones: [
              "Clinical Trials - Unit A",
              "Clinical Trials - Unit B",
              "Clinical Trials - Unit C",
              "Genomics Lab",
              "Genomics - Sequencing",
              "Immunology - Research",
              "Immunology - Cell Lab",
              "Proteomics Lab",
            ],
          },
          {
            label: "Floor 2",
            zones: [
              "Neuroscience Lab A",
              "Neuroscience Lab B",
              "Cardio Research",
              "Cardio - Stress Testing",
              "Rehabilitation - Physio A",
              "Rehabilitation - Physio B",
              "Recovery - General",
              "Stem Cell Research",
            ],
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

          // 2 ESP32 devices per room
          for (let dIdx = 0; dIdx < 2; dIdx++) {
            const device = await prisma.device.create({
              data: {
                name: `ESP32 ${zoneName.split(" ")[0]}-${dIdx + 1}`,
                type: "ESP32",
                status: Math.random() > 0.1 ? "ONLINE" : "OFFLINE",
                zoneId: zone.id,
              },
            });

            // 4 sensors per device
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

              await prisma.alertRule.createMany({
                data: [
                  {
                    name: `${config.type} High – ${zoneName}`,
                    sensorId: sensor.id,
                    condition: "ABOVE",
                    threshold: config.max * 0.9,
                    severity: "HIGH",
                    enabled: true,
                  },
                  {
                    name: `${config.type} Low – ${zoneName}`,
                    sensorId: sensor.id,
                    condition: "BELOW",
                    threshold: config.min * 1.1,
                    severity: "MEDIUM",
                    enabled: true,
                  },
                ],
              });

              // 30 days of readings every 30 min
              const readings = [];
              const now = Date.now();
              for (let i = 0; i < 1440; i++) {
                const timestamp = new Date(now - (1440 - i) * 30 * 60 * 1000);
                const hourOfDay = timestamp.getHours();
                const dayFactor = Math.sin(((hourOfDay - 6) * Math.PI) / 12) * 0.3;
                const noise = (Math.random() - 0.5) * (config.max - config.min) * 0.15;
                const value = Math.max(
                  config.min,
                  Math.min(
                    config.max,
                    config.base + dayFactor * (config.max - config.min) * 0.3 + noise
                  )
                );
                readings.push({
                  sensorId: sensor.id,
                  value: Math.round(value * 100) / 100,
                  timestamp,
                });
              }

              const chunkSize = 500;
              for (let i = 0; i < readings.length; i += chunkSize) {
                await prisma.sensorReading.createMany({
                  data: readings.slice(i, i + chunkSize),
                });
              }

              if (Math.random() > 0.5) {
                const alertValue = config.max * (0.9 + Math.random() * 0.15);
                await prisma.alert.create({
                  data: {
                    message: `${sensor.name}: value ${alertValue.toFixed(1)} ${config.unit} exceeds threshold ${(config.max * 0.9).toFixed(1)} ${config.unit}`,
                    severity: Math.random() > 0.5 ? "HIGH" : "MEDIUM",
                    value: alertValue,
                    threshold: config.max * 0.9,
                    sensorId: sensor.id,
                    acknowledged: Math.random() > 0.5,
                    createdAt: new Date(now - Math.random() * 48 * 60 * 60 * 1000),
                  },
                });
              }
            }

            globalDeviceIdx++;
          }
        }
      }
    }

    const totalZones = hospitals.reduce((a, h) => a + h.floors.reduce((b, f) => b + f.zones.length, 0), 0);
    const totalDevices = totalZones * 2;
    const totalSensors = totalDevices * 4;

    return NextResponse.json({
      success: true,
      message: "Seed data created successfully",
      summary: {
        hospitals: hospitals.length,
        totalZones,
        totalDevices,
        totalSensors,
        totalReadings: totalSensors * 1440,
        deviceType: "ESP32 only",
      },
    });
  } catch (error) {
    console.error("🔥 SEED ERROR:", error);
    return NextResponse.json(
      {
        error: "Failed to seed data",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}