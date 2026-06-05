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

    // Create hospitals, zones, devices, sensors, readings, and alert rules
    const h1 = await prisma.hospital.create({
      data: {
        name: "Main Hospital",
        location: "Building A, North Wing",
        description: "Primary medical facility for patient care",
      },
    });

    const h2 = await prisma.hospital.create({
      data: {
        name: "Research Hospital",
        location: "Building B, East Side",
        description: "Experimental treatments and research facility",
      },
    });

    const zoneNames = [
      ["ICU - Intensive Care", "Emergency - Trauma", "Cardiology - Heart"],
      ["Neurology - Brain", "Orthopedics - Bones", "General - Ward"],
    ];
    const rooms = []
    

    const sensorConfigs = [
      { type: "HEART_RATE", unit: "bpm", min: 50, max: 120, base: 75 },
      { type: "SPO2_LEVEL", unit: "%", min: 90, max: 100, base: 98 },
      { type: "ECG_SIGNAL", unit: "mV", min: -1, max: 5, base: 0.5 },
      { type: "RESPIRATION_RATE", unit: "breaths/min", min: 12, max: 25, base: 16 },
      { type: "BODY_TEMPERATURE", unit: "°C", min: 35, max: 40, base: 37 },
      { type: "BLOOD_PRESSURE_SYS", unit: "mmHg", min: 90, max: 180, base: 120 },
      { type: "BLOOD_PRESSURE_DIA", unit: "mmHg", min: 50, max: 110, base: 80 },
      { type: "BLOOD_GLUCOSE", unit: "mg/dL", min: 70, max: 200, base: 100 },
    ];

    for (const [ghIndex, gh] of [h1, h2].entries()) {
      for (const [zIndex, zoneName] of zoneNames[ghIndex].entries()) {
        const zone = await prisma.zone.create({
          data: {
            name: zoneName,
            description: `Medical Zone in ${gh.name}`,
            hospitalId: gh.id,
          },
        });

        for (let dIdx = 0; dIdx < 2; dIdx++) {
          const device = await prisma.device.create({
            data: {
              name: `Patient Monitor ${zoneName.split(" - ")[0]}-${dIdx + 1}`,
              type: dIdx === 0 ? "ESP32" : "Arduino Nano",
              status: Math.random() > 0.1 ? "ONLINE" : "OFFLINE",
              zoneId: zone.id,
            },
          });

          // Assign 4 sensors per device (rotating through all medical sensors)
          const startIdx = (dIdx * 4) % sensorConfigs.length;
          const deviceSensors = [
            sensorConfigs[(startIdx) % sensorConfigs.length],
            sensorConfigs[(startIdx + 1) % sensorConfigs.length],
            sensorConfigs[(startIdx + 2) % sensorConfigs.length],
            sensorConfigs[(startIdx + 3) % sensorConfigs.length],
          ];

          for (const config of deviceSensors) {
            const sensor = await prisma.sensor.create({
              data: {
                name: `${config.type.replace(/_/g, " ")} - ${zoneName}`,
                type: config.type,
                unit: config.unit,
                minValue: config.min,
                maxValue: config.max,
                deviceId: device.id,
              },
            });

            // Create alert rules
            await prisma.alertRule.create({
              data: {
                name: `${config.type} High - ${zoneName}`,
                sensorId: sensor.id,
                condition: "ABOVE",
                threshold: config.max * 0.9,
                severity: "HIGH",
                enabled: true,
              },
            });

            await prisma.alertRule.create({
              data: {
                name: `${config.type} Low - ${zoneName}`,
                sensorId: sensor.id,
                condition: "BELOW",
                threshold: config.min * 1.1,
                severity: "MEDIUM",
                enabled: true,
              },
            });

            // Generate 30 days of readings (every 30 min = 1440 readings)
            const readings = [];
            const now = Date.now();
            for (let i = 0; i < 1440; i++) {
              const timestamp = new Date(now - (1440 - i) * 30 * 60 * 1000);
              const hourOfDay = timestamp.getHours();
              const dayFactor = Math.sin(((hourOfDay - 6) * Math.PI) / 12) * 0.3;
              const noise = (Math.random() - 0.5) * (config.max - config.min) * 0.15;
              const value = Math.max(
                config.min,
                Math.min(config.max, config.base + dayFactor * (config.max - config.min) * 0.3 + noise)
              );

              readings.push({
                sensorId: sensor.id,
                value: Math.round(value * 100) / 100,
                timestamp,
              });
            }

            // await prisma.sensorReading.createMany({ data: readings });
            const chunkSize = 500;

            for (let i = 0; i < readings.length; i += chunkSize) {
              await prisma.sensorReading.createMany({
                data: readings.slice(i, i + chunkSize),
              });
            }

            // Create some triggered alerts
            if (Math.random() > 0.5) {
              const alertValue = config.max * (0.9 + Math.random() * 0.15);
              await prisma.alert.create({
                data: {
                  message: `${sensor.name}: value ${alertValue.toFixed(1)} ${config.unit} is above threshold ${(config.max * 0.9).toFixed(1)} ${config.unit}`,
                  severity: "HIGH",
                  value: alertValue,
                  threshold: config.max * 0.9,
                  sensorId: sensor.id,
                  acknowledged: Math.random() > 0.5,
                  createdAt: new Date(now - Math.random() * 24 * 60 * 60 * 1000),
                },
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: "Seed data created successfully" });
  // } catch (error) {
  //   console.error("Seed error:", error);
  //   return NextResponse.json({ error: "Failed to seed data" }, { status: 500 });
  // }
  } catch (error) {
    console.error("🔥 FULL ERROR:", error);
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
