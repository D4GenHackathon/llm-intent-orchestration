"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";

// ─── Seeded deterministic random ────────────────────────────────────────────
function seededRng(seed: string | number) {
  let s = typeof seed === "string"
    ? seed.split("").reduce((a, c) => (Math.imul(31, a) + c.charCodeAt(0)) | 0, 0)
    : seed | 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return ((s >>> 0) / 0xffffffff);
  };
}

// ─── Room type classification ─────────────────────────────────────────────────
// Returns a stable string type used for furniture/bed logic.
// More granular lab subtypes so pathology ≠ microbiology ≠ biobank etc.
function classifyRoom(name = "", capacity = 4): string {
  const n = name.toLowerCase();
  if (n.includes("icu") || n.includes("intensive"))                          return "icu";
  if (n.includes("surgery") || n.includes("operating") || n.includes("or ")) return "surgery";
  if (n.includes("pathol") || n.includes("histol") || n.includes("cytol"))   return "lab_pathology";
  if (n.includes("microbiol") || n.includes("bacteriol") || n.includes("virol")) return "lab_microbiology";
  if (n.includes("biobank") || n.includes("bio bank") || n.includes("specimen") || n.includes("blood bank")) return "lab_biobank";
  if (n.includes("biochem") || n.includes("haematol") || n.includes("hematol") || n.includes("chemical")) return "lab_biochemistry";
  if (n.includes("lab") || n.includes("laborat"))                            return "lab_general";
  if (n.includes("radiol") || n.includes("imaging") || n.includes("xray") || n.includes("mri") || n.includes("ct scan") || n.includes("ultrasound")) return "imaging";
  if (n.includes("pharmacy") || n.includes("pharma") || n.includes("dispensar")) return "pharmacy";
  if (n.includes("recov") || n.includes("pacu"))                             return "recovery";
  if (n.includes("consult") || n.includes("exam") || n.includes("office") || n.includes("clinic")) return "consult";
  if (n.includes("storage") || n.includes("supply") || n.includes("utility") || n.includes("steril")) return "utility";
  if (n.includes("lounge") || n.includes("staff") || n.includes("break") || n.includes("nurse") || n.includes("reception") || n.includes("admission")) return "staff";
  if (capacity <= 2) return "consult";
  if (capacity <= 4) return "ward_small";
  return "ward_large";
}

// ─── Color per room type ──────────────────────────────────────────────────────
// Same broad category → similar hue family, but distinct enough to tell apart.
const ROOM_TYPE_COLORS: Record<string, number> = {
  icu:               0xe05252, // red
  surgery:           0x5a8ae0, // blue
  lab_pathology:     0xf39c12, // amber
  lab_microbiology:  0x27ae60, // green
  lab_biobank:       0x95a5a6, // grey-blue
  lab_biochemistry:  0xe67e22, // orange
  lab_general:       0xd4ac0d, // yellow-gold
  imaging:           0x9b59b6, // purple
  pharmacy:          0x2ecc71, // mint green
  recovery:          0x4eb88a, // teal
  consult:           0x1abc9c, // cyan-teal
  utility:           0x7f8c8d, // grey
  staff:             0x3498db, // sky blue
  ward_small:        0x4a90d9, // blue
  ward_large:        0x3a7bd5, // deeper blue
};

// ─── For same-type rooms, derive a subtle hue shift from the full name ────────
// e.g. "Microbiology Lab A" vs "Microbiology Lab B" → same family, slightly different shade
function roomColor(name: string, capacity: number): number {
  const type = classifyRoom(name, capacity);
  const base = ROOM_TYPE_COLORS[type] ?? 0x4a90d9;

  // Hash the name to a small ±shift on hue
  const nameHash = name.split("").reduce((a, c) => (Math.imul(31, a) + c.charCodeAt(0)) | 0, 0);
  const shift = ((nameHash >>> 0) % 40) - 20; // –20 to +20 hue degrees

  // Decompose base color, shift hue, recompose
  const r = (base >> 16) & 0xff;
  const g = (base >>  8) & 0xff;
  const b =  base        & 0xff;

  // RGB → HSL
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rf: h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6; break;
      case gf: h = ((bf - rf) / d + 2) / 6; break;
      default: h = ((rf - gf) / d + 4) / 6;
    }
  }

  h = ((h * 360 + shift + 360) % 360) / 360;

  // HSL → RGB
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p2 = 2 * l - q2;
  const nr = Math.round(hue2rgb(p2, q2, h + 1/3) * 255);
  const ng = Math.round(hue2rgb(p2, q2, h)       * 255);
  const nb = Math.round(hue2rgb(p2, q2, h - 1/3) * 255);
  return (nr << 16) | (ng << 8) | nb;
}

// ─── Per-floor palette & personality ─────────────────────────────────────────
const FLOOR_THEMES: Record<string, any>[] = [
  { wallColor: 0xd8d2c5, floorColor: 0xf0ece4, accentColor: 0x4a90d9, trim: 0xc8b89a, name: "Ground" },
  { wallColor: 0xcdd5e0, floorColor: 0xe8edf5, accentColor: 0x5a8ae0, trim: 0xa0b4cc, name: "First" },
  { wallColor: 0xcde0d5, floorColor: 0xe5f5ee, accentColor: 0x4eb88a, trim: 0x90c4a8, name: "Second" },
  { wallColor: 0xe0d5cd, floorColor: 0xf5ede8, accentColor: 0xe07d35, trim: 0xc4a090, name: "Third" },
  { wallColor: 0xd5cde0, floorColor: 0xeee8f5, accentColor: 0x9b59b6, trim: 0xb090c4, name: "Fourth" },
];

// ─── Compute layout packing from zones array ──────────────────────────────────
// Generates different-sized rooms tightly packed into columns
function computeLayouts(zones: any[], rng: () => number) {
  const BUILDING_W = 30;
  const BUILDING_D = 18;
  const CORRIDOR_Z  = 1;   // corridor center Z
  const CORRIDOR_H  = 2.2; // corridor depth
  const MARGIN      = 0.3;

  // Assign each zone a relative size based on capacity / type
  const sizes = zones.map((z: any) => {
    const type = classifyRoom(z.name, z.devices?.length ?? 2);
    const base = {
      icu: 1.4, surgery: 1.6, imaging: 1.5, lab: 1.2,
      pharmacy: 1.0, recovery: 1.3, consult: 0.7, utility: 0.6,
      staff: 0.8, ward_small: 1.0, ward_large: 1.4,
    }[type] ?? 1.0;
    // Add slight random variation per room
    return base * (0.85 + rng() * 0.3);
  });

  const totalSize = sizes.reduce((a, b) => a + b, 0);
  const half = Math.floor(zones.length / 2);

  // Split into top row (row 0) and bottom row (row 1)
  const topZones    = zones.slice(0, half);
  const bottomZones = zones.slice(half);
  const topSizes    = sizes.slice(0, half);
  const bottomSizes = sizes.slice(half);

  const topTotal    = topSizes.reduce((a, b) => a + b, 0) || 1;
  const bottomTotal = bottomSizes.reduce((a, b) => a + b, 0) || 1;

  const layouts: { x: number; z: number; w: number; d: number }[] = [];
  const slabHalfW = BUILDING_W / 2;

  // Top row: negative Z side
  let curX = -slabHalfW + MARGIN;
  topZones.forEach((z: any, i: number) => {
    const frac = topSizes[i] / topTotal;
    const w    = (BUILDING_W - 2 * MARGIN) * frac - MARGIN;
    const d    = BUILDING_D / 2 - CORRIDOR_H / 2 - MARGIN * 2;
    const x    = curX;
    const zPos = -(CORRIDOR_Z + CORRIDOR_H / 2 + d / 2 + MARGIN);
    layouts.push({ x, z: zPos - d / 2, w: Math.max(w, 3.5), d: Math.max(d, 3) });
    curX += w + MARGIN;
  });

  // Bottom row: positive Z side
  curX = -slabHalfW + MARGIN;
  bottomZones.forEach((z: any, i: number) => {
    const frac = bottomSizes[i] / bottomTotal;
    const w    = (BUILDING_W - 2 * MARGIN) * frac - MARGIN;
    const d    = BUILDING_D / 2 - CORRIDOR_H / 2 - MARGIN * 2;
    const x    = curX;
    const zPos = CORRIDOR_Z + CORRIDOR_H / 2 + d / 2 + MARGIN;
    layouts.push({ x, z: zPos - d / 2, w: Math.max(w, 3.5), d: Math.max(d, 3) });
    curX += w + MARGIN;
  });

  return layouts;
}

// ─── Bed placement per room type ─────────────────────────────────────────────
function placeBeds(group: THREE.Group, type: string, cx: number, cz: number, w: number, d: number, rng: () => number) {
  const mats = {
    standard:  new THREE.MeshLambertMaterial({ color: 0xeeeae0 }),
    icu:       new THREE.MeshLambertMaterial({ color: 0xdce8f0 }),
    surgery:   new THREE.MeshLambertMaterial({ color: 0xd0d8e0 }),
  };

  const bedMat  = type === "icu" ? mats.icu : type === "surgery" ? mats.surgery : mats.standard;
  const pillow  = new THREE.MeshLambertMaterial({ color: 0xfaf8f2 });

  // Determine bed count from room size and type
  let maxBeds;
  if (type === "icu")        maxBeds = Math.max(1, Math.floor(Math.min(w, d) / 2.5));
  else if (type === "surgery") maxBeds = 1;
  else if (type === "consult") maxBeds = 1;
  else if (type.startsWith("lab_") || type === "lab" || type === "pharmacy" || type === "utility" || type === "staff") maxBeds = 0;
  else if (type === "imaging") maxBeds = 1;
  else maxBeds = Math.max(1, Math.floor(w / 1.8) * Math.floor(d / 2.8));

  if (maxBeds === 0) return;

  // Layout beds in a grid
  const cols = type === "icu" ? 1 : Math.max(1, Math.floor(w / 1.9));
  const rows = Math.ceil(maxBeds / cols);
  const bw   = type === "icu" ? 1.0 : 0.8;
  const bd   = type === "icu" ? 2.2 : 1.9;
  const xSpacing = (w - 1.2) / Math.max(cols, 1);
  const zSpacing = (d - 1.2) / Math.max(rows, 1);

  let count = 0;
  for (let row = 0; row < rows && count < maxBeds; row++) {
    for (let col = 0; col < cols && count < maxBeds; col++) {
      const bx = cx - w / 2 + 0.6 + col * xSpacing + xSpacing / 2;
      const bz = cz - d / 2 + 0.7 + row * zSpacing + zSpacing / 2;

      // Slight random rotation for natural feel
      const angle = (rng() - 0.5) * 0.06;

      const bed = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.22, bd), bedMat);
      bed.position.set(bx, 0.2, bz);
      bed.rotation.y = angle;
      bed.castShadow = true;
      group.add(bed);

      const pw = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.7, 0.1, 0.32), pillow);
      pw.position.set(bx, 0.33, bz - bd / 2 + 0.28);
      pw.rotation.y = angle;
      group.add(pw);

      // ICU: add side equipment rack
      if (type === "icu") {
        const rack = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 1.0, 0.18),
          new THREE.MeshLambertMaterial({ color: 0x888888 })
        );
        rack.position.set(bx + bw / 2 + 0.18, 0.5, bz);
        group.add(rack);
        const monitor = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.2, 0.06),
          new THREE.MeshLambertMaterial({ color: 0x111111 })
        );
        monitor.position.set(bx + bw / 2 + 0.18, 1.05, bz - 0.08);
        group.add(monitor);
      }

      count++;
    }
  }
}

// ─── Furniture per room type ──────────────────────────────────────────────────
function addRoomFurniture(group: THREE.Group, type: string, cx: number, cz: number, w: number, d: number, rng: () => number, floorTheme: any) {
  const woodMat  = new THREE.MeshLambertMaterial({ color: floorTheme.trim });
  const darkMat  = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });

  switch (type) {
    case "surgery": {
      // Operating lamp above center
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), metalMat);
      arm.position.set(cx, 2.2, cz);
      group.add(arm);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.14, 16), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
      lamp.position.set(cx, 1.45, cz);
      group.add(lamp);
      // Instrument tray
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.4), metalMat);
      tray.position.set(cx + w * 0.3, 0.8, cz);
      group.add(tray);
      break;
    }
    case "lab_pathology":
    case "lab_microbiology":
    case "lab_biochemistry":
    case "lab_biobank":
    case "lab_general":
    case "lab": {
      // Lab benches along walls
      const bw = w * 0.8;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.72, 0.7), woodMat);
      bench.position.set(cx, 0.36, cz - d / 2 + 0.45);
      group.add(bench);
      const bench2 = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.72, 0.7), woodMat);
      bench2.position.set(cx, 0.36, cz + d / 2 - 0.45);
      group.add(bench2);
      // Microscope
      for (let i = 0; i < Math.floor(bw / 1.2); i++) {
        if (rng() > 0.4) {
          const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.35, 8), darkMat);
          scope.position.set(cx - bw / 2 + 0.5 + i * 1.1, 1.14, cz - d / 2 + 0.45);
          group.add(scope);
        }
      }
      break;
    }
    case "imaging": {
      // MRI/CT tube
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 24), new THREE.MeshLambertMaterial({ color: 0xe8e4dc }));
      tube.rotation.z = Math.PI / 2;
      tube.position.set(cx, 0.85, cz);
      group.add(tube);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.55, 20), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      inner.rotation.z = Math.PI / 2;
      inner.position.set(cx, 0.85, cz);
      group.add(inner);
      // Control desk
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 0.6), woodMat);
      desk.position.set(cx + w * 0.35, 0.32, cz + d * 0.3);
      group.add(desk);
      break;
    }
    case "pharmacy": {
      // Shelf units
      const shelfCount = Math.floor(w / 1.6);
      for (let i = 0; i < shelfCount; i++) {
        const sx = cx - w / 2 + 0.5 + i * (w / shelfCount);
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.28), woodMat);
        shelf.position.set(sx, 0.7, cz - d / 2 + 0.22);
        group.add(shelf);
        // Shelf dividers
        for (let sh = 0; sh < 4; sh++) {
          const div = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.26), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
          div.position.set(sx, 0.1 + sh * 0.4, cz - d / 2 + 0.22);
          group.add(div);
        }
      }
      // Counter
      const counter = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.85, 0.55), woodMat);
      counter.position.set(cx, 0.42, cz + d * 0.3);
      group.add(counter);
      break;
    }
    case "consult": {
      // Desk + 2 chairs
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.72, 0.7), woodMat);
      desk.position.set(cx - 0.2, 0.36, cz);
      group.add(desk);
      [-0.4, 0.4].forEach((oz: number) => {
        const chair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.44), new THREE.MeshLambertMaterial({ color: 0x3a5a8a }));
        chair.position.set(cx + 0.9, 0.44, cz + oz);
        group.add(chair);
      });
      break;
    }
    case "staff": {
      // Lounge: sofa + table
      const sofa = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.65), new THREE.MeshLambertMaterial({ color: 0x5a7a9a }));
      sofa.position.set(cx - 0.5, 0.3, cz - d * 0.2);
      group.add(sofa);
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.65, 12), new THREE.MeshLambertMaterial({ color: floorTheme.trim }));
      table.position.set(cx + 0.6, 0.32, cz - d * 0.2);
      group.add(table);
      break;
    }
    case "utility": {
      // Storage cabinets
      const cols = Math.floor(w / 1.1);
      for (let i = 0; i < cols; i++) {
        const cab = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 1.5, 0.5),
          new THREE.MeshLambertMaterial({ color: 0xd0ccc0 })
        );
        cab.position.set(cx - w / 2 + 0.45 + i * ((w - 0.5) / cols), 0.75, cz - d / 2 + 0.35);
        group.add(cab);
      }
      break;
    }
    default: { // ward
      // Nightstand per ~2 beds
      const nsMat = new THREE.MeshLambertMaterial({ color: floorTheme.trim });
      const nsCount = Math.max(1, Math.floor(w / 3));
      for (let i = 0; i < nsCount; i++) {
        const ns = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.38), nsMat);
        ns.position.set(cx - w / 2 + 0.5 + i * (w / nsCount), 0.28, cz + d / 2 - 0.45);
        group.add(ns);
      }
      break;
    }
  }
}

// ─── Corridor / lobby details per floor ─────────────────────────────────────
function addFloorCorridorDetails(group: THREE.Group, floorIdx: number, floorTheme: any, rng: () => number) {
  const accentMat = new THREE.MeshLambertMaterial({ color: floorTheme.accentColor });

  // Seating along corridor — quantity varies by floor
  const seatCount = 3 + Math.floor(rng() * 5);
  for (let i = 0; i < seatCount; i++) {
    const cx = -12 + (24 / (seatCount - 1 || 1)) * i;
    const seatMat = new THREE.MeshLambertMaterial({ color: floorTheme.accentColor });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.44), seatMat);
    seat.position.set(cx, 0.42, floorIdx % 2 === 0 ? 0.8 : -0.8);
    group.add(seat);
    [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([lx, lz]: number[]) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6),
        new THREE.MeshLambertMaterial({ color: 0x888888 })
      );
      leg.position.set(cx + lx, 0.21, (floorIdx % 2 === 0 ? 0.8 : -0.8) + lz);
      group.add(leg);
    });
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.06), seatMat);
    back.position.set(cx, 0.65, floorIdx % 2 === 0 ? 0.58 : -1.02);
    group.add(back);
  }

  // Plants at corridor ends — denser on ground floor
  const plantCount = floorIdx === 0 ? 4 : 2;
  const plantPositions = [
    [-13, -7.5], [13, -7.5], [-13, 7.5], [13, 7.5]
  ].slice(0, plantCount);

  plantPositions.forEach(([px, pz]: number[]) => {
    if (rng() > 0.25) {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.16, 0.35, 10),
        new THREE.MeshLambertMaterial({ color: 0xa0522d })
      );
      pot.position.set(px, 0.25, pz);
      group.add(pot);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.5 + rng() * 0.4, 8),
        new THREE.MeshLambertMaterial({ color: 0x6b4226 })
      );
      const trunkH = 0.5 + rng() * 0.4;
      trunk.position.set(px, 0.55 + trunkH / 2, pz);
      group.add(trunk);
      [[0, 0, 0.3 + rng() * 0.1], [0.15, 0.22, 0.22], [-0.1, 0.24, 0.2]].forEach(([ox, oy, r]: number[]) => {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(r, 9, 9),
          new THREE.MeshLambertMaterial({ color: 0x2d7a3a })
        );
        leaf.position.set(px + ox, 0.55 + trunkH + oy, pz);
        group.add(leaf);
      });
    }
  });

  // Floor arrows — only on ground floor and first floor
  if (floorIdx <= 1) {
    [-8, -4, 0, 4, 8].forEach((ax: number) => {
      const ac = document.createElement("canvas");
      ac.width = 64; ac.height = 64;
      const ctx = ac.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, 64, 64);
      ctx.fillStyle = `#${floorTheme.accentColor.toString(16).padStart(6, "0")}44`;
      ctx.beginPath();
      ctx.moveTo(32, 8); ctx.lineTo(52, 40); ctx.lineTo(38, 40);
      ctx.lineTo(38, 56); ctx.lineTo(26, 56); ctx.lineTo(26, 40);
      ctx.lineTo(12, 40); ctx.closePath();
      ctx.fill();
      const arrow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.7),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ac), transparent: true, depthWrite: false })
      );
      arrow.rotation.x = -Math.PI / 2;
      arrow.position.set(ax, 0.1, 0);
      group.add(arrow);
    });
  }

  // Ground floor reception desk
  if (floorIdx === 0) {
    const deskMat = new THREE.MeshLambertMaterial({ color: floorTheme.trim });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.65, 0.8), deskMat);
    desk.position.set(0, 0.37, -0.8);
    group.add(desk);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.07, 0.9),
      new THREE.MeshLambertMaterial({ color: 0xd4c4aa })
    );
    top.position.set(0, 0.72, -0.8);
    group.add(top);
    // Receptionist figure
    const bodyFig = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.15, 0.65, 8),
      accentMat
    );
    bodyFig.position.set(0.5, 1.12, -0.4);
    group.add(bodyFig);
    const headFig = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xf0c090 })
    );
    headFig.position.set(0.5, 1.6, -0.4);
    group.add(headFig);
  }

  // Upper floors: nurse station
  if (floorIdx > 0) {
    const station = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.85, 1.0),
      new THREE.MeshLambertMaterial({ color: floorTheme.trim })
    );
    station.position.set(0, 0.42, 0);
    group.add(station);
    const monMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.05), monMat);
    mon.position.set(-0.3, 1.0, -0.46);
    group.add(mon);
  }
}

// ─── Build one floor from hospital data ─────────────────────────────────────
function buildFloor(scene: THREE.Scene, floorIdx: number, floorData: any, floorTheme: any, onMeshAdded: (mesh: THREE.Mesh) => void, highlightZone?: string, alertDeviceIds: Set<string> = new Set(), onPulse?: (mesh: THREE.Mesh) => void) {
  const rng = seededRng(`floor_${floorIdx}_${floorData.label ?? floorIdx}`);
  const group = new THREE.Group();

  const BUILDING_W = 30, BUILDING_D = 18;

  // Floor slab
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(BUILDING_W, 0.18, BUILDING_D),
    new THREE.MeshLambertMaterial({ color: floorTheme.floorColor })
  );
  slab.receiveShadow = true;
  group.add(slab);

  // Outer walls
  const wallMat = new THREE.MeshLambertMaterial({ color: floorTheme.wallColor, transparent: true, opacity: 0.5 });
  [
    [BUILDING_W, 0.5, 0.2,  0,           0.25, -BUILDING_D / 2],
    [BUILDING_W, 0.5, 0.2,  0,           0.25,  BUILDING_D / 2],
    [0.2, 0.5, BUILDING_D, -BUILDING_W / 2, 0.25, 0],
    [0.2, 0.5, BUILDING_D,  BUILDING_W / 2, 0.25, 0],
  ].forEach(([w, h, d, x, y, z]: number[]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(x, y, z);
    group.add(wall);
  });

  // Corridors
  const corrMat = new THREE.MeshLambertMaterial({ color: floorTheme.floorColor });
  const hCorr = new THREE.Mesh(new THREE.BoxGeometry(BUILDING_W, 0.05, 2.2), corrMat);
  hCorr.position.set(0, 0.1, 0);
  group.add(hCorr);

  // Compute layouts automatically
  const layouts = computeLayouts(floorData.zones, rng);

  // Zones
  floorData.zones.forEach((zone: any, zi: number) => {
    const layout = layouts[zi] ?? { x: -5, z: -5, w: 5, d: 5 };
    const type   = classifyRoom(zone.name, zone.devices?.length ?? 2);
    const color  = roomColor(zone.name, zone.devices?.length ?? 2);
    const cx = layout.x + layout.w / 2;
    const cz = layout.z + layout.d / 2;

    // Zone floor tint — brighter if this is the highlighted zone
    const isHighlighted = highlightZone && zone.name === highlightZone;
    if (isHighlighted) console.log("[Map] Highlighting zone:", zone.name);
    const zoneFloor = new THREE.Mesh(
      new THREE.BoxGeometry(layout.w - 0.15, 0.06, layout.d - 0.15),
      new THREE.MeshLambertMaterial({ color, transparent: true, opacity: isHighlighted ? 0.7 : 0.18 })
    );
    zoneFloor.position.set(cx, 0.12, cz);
    zoneFloor.userData = { type: "zone", zoneId: zone.id, name: zone.name, detail: `${zone.devices?.length ?? 0} devices · ${type}` };
    group.add(zoneFloor);
    onMeshAdded(zoneFloor);

    // Highlight: add a glowing outline box around the zone
    if (isHighlighted) {
      const wallH = 1.3;
      const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, wireframe: false, side: THREE.DoubleSide });
      const glowBox = new THREE.Mesh(
        new THREE.BoxGeometry(layout.w, wallH, layout.d),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08 })
      );
      glowBox.position.set(cx, wallH / 2, cz);
      group.add(glowBox);
      // Solid bright top edge lines
      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(layout.w, wallH, layout.d));
      const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
      const wireframe = new THREE.LineSegments(edges, lineMat);
      wireframe.position.set(cx, wallH / 2, cz);
      group.add(wireframe);
    }

    // Zone walls — height varies by floor
    const wallH = 1.1 + floorIdx * 0.05;
    const zwMat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.25 });
    [
      [layout.w, wallH, 0.12, cx,              wallH/2, layout.z],
      [layout.w, wallH, 0.12, cx,              wallH/2, layout.z + layout.d],
      [0.12, wallH, layout.d, layout.x,        wallH/2, cz],
      [0.12, wallH, layout.d, layout.x+layout.w, wallH/2, cz],
    ].forEach(([w, h, d, x, y, z]: number[]) => {
      const zw = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), zwMat);
      zw.position.set(x, y, z);
      group.add(zw);
    });

    // Zone label
    const lc = document.createElement("canvas");
    lc.width = 512; lc.height = 64;
    const lctx = lc.getContext("2d");
    if (!lctx) return;
    lctx.clearRect(0, 0, 512, 64);
    lctx.font = "bold 17px system-ui";
    lctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    lctx.textAlign = "center";
    lctx.fillText(zone.name, 256, 40);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(layout.w * 0.85, 0.55),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lc), transparent: true, depthWrite: false })
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(cx, 0.2, layout.z + 0.45);
    group.add(label);

    // Beds — procedural per room type
    placeBeds(group, type, cx, cz, layout.w, layout.d, seededRng(`beds_${floorIdx}_${zi}`));

    // Furniture — procedural per room type
    addRoomFurniture(group, type, cx, cz, layout.w, layout.d, seededRng(`furn_${floorIdx}_${zi}`), floorTheme);

    // Devices (2 per zone, offset within room)
    const devRng = seededRng(`dev_${floorIdx}_${zi}`);
    const offsets = layout.w > 4
      ? [[-layout.w * 0.25, 0], [layout.w * 0.25, 0]]
      : [[-0.9, 0], [0.9, 0]];

    zone.devices?.slice(0, 2).forEach((dev: any, di: number) => {
      const [ox, oz] = offsets[di % offsets.length];
      const dx = cx + ox, dz = cz + layout.d * 0.3;

      const bodyColor = dev.status !== "ONLINE" ? 0x666666 : 0x2c2c2a;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.65, 0.3),
        new THREE.MeshLambertMaterial({ color: bodyColor })
      );
      body.position.set(dx, 0.42, dz);
      body.castShadow = true;
      body.userData = { type: "device", deviceId: dev.id, name: dev.name, detail: dev.status, status: dev.status };
      group.add(body);
      onMeshAdded(body);

      const scrColor = dev.status === "ONLINE" ? 0x0d4f38 : 0x3d1010;
      const scr = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.26, 0.02),
        new THREE.MeshLambertMaterial({ color: scrColor })
      );
      scr.position.set(dx, 0.56, dz - 0.16);
      group.add(scr);

      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.08, 0.15, 8),
        new THREE.MeshLambertMaterial({ color: 0x555555 })
      );
      stand.position.set(dx, 0.085, dz);
      group.add(stand);

      const hasAlert  = alertDeviceIds.has(dev.id);
      const isOffline  = dev.status !== "ONLINE";
      const dotColor   = hasAlert ? 0xFF2222 : isOffline ? 0x888888 : 0x1D9E75;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 10, 10),
        new THREE.MeshBasicMaterial({ color: dotColor })
      );
      dot.position.set(dx + 0.18, 0.8, dz);
      group.add(dot);

      // Alert: pulsing red ring above device
      if (hasAlert) {
        const alertRing = new THREE.Mesh(
          new THREE.RingGeometry(0.10, 0.17, 16),
          new THREE.MeshBasicMaterial({ color: 0xFF2222, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
        );
        alertRing.rotation.x = -Math.PI / 2;
        alertRing.position.set(dx, 1.05, dz);
        alertRing.userData.isPulse = true;
        alertRing.userData.phase   = Math.random() * Math.PI * 2;
        alertRing.userData.isAlert = true;
        group.add(alertRing);
        onPulse?.(alertRing);

        // Exclamation marker
        const excl = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8),
          new THREE.MeshBasicMaterial({ color: 0xFF2222 })
        );
        excl.position.set(dx, 1.2, dz);
        group.add(excl);
        const exclDot = new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xFF2222 })
        );
        exclDot.position.set(dx, 1.05, dz);
        group.add(exclDot);
      }

      return { dot };
    });
  });

  addFloorCorridorDetails(group, floorIdx, floorTheme, seededRng(`corridor_${floorIdx}`));

  scene.add(group);
  return group;
}

// ─── Main component ───────────────────────────────────────────────────────────
interface HospitalMap3DProps {
  hospitalData: any;
  initialFloor?: number;
  highlightZone?: string;
  alertDeviceIds?: Set<string>;  // device ids with active critical/high alerts
}

export default function HospitalMap3D({ hospitalData, initialFloor = 0, highlightZone, alertDeviceIds = new Set() }: HospitalMap3DProps) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const sceneRef    = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef    = useRef<number | null>(null);
  const meshesRef   = useRef<THREE.Mesh[]>([]);
  const pulsesRef   = useRef<THREE.Mesh[]>([]);
  const floorGroupsRef = useRef<THREE.Group[]>([]);
  const isRotatingRef  = useRef(true);
  const rotYRef        = useRef(0.3);
  const isDraggingRef  = useRef(false);
  const lastXRef       = useRef(0);

  const [selectedFloor, setSelectedFloor] = useState(initialFloor);
  const router = useRouter();
  const [hovered,  setHovered]  = useState<Record<string, any> | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isRotating, setIsRotating] = useState(true);

  const rebuildFloor = useCallback((scene:any, floorIdx:number) => {
    meshesRef.current = [];
    pulsesRef.current = [];
    floorGroupsRef.current.forEach((g: THREE.Group) => scene.remove(g));
    floorGroupsRef.current = [];

    const floorData = hospitalData.floors[floorIdx];
    const theme = FLOOR_THEMES[floorIdx % FLOOR_THEMES.length];

    const group = buildFloor(scene, floorIdx, floorData, theme, (mesh) => {
      meshesRef.current.push(mesh);
    }, highlightZone, alertDeviceIds, (pulse) => {
      pulsesRef.current.push(pulse);
    });
    floorGroupsRef.current.push(group);
  }, [hospitalData, highlightZone, alertDeviceIds]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf0ece4, 0.020);
    sceneRef.current = scene;

    scene.add(new THREE.AmbientLight(0xfff8f0, 0.75));
    const sun = new THREE.DirectionalLight(0xfff8e8, 1.1);
    sun.position.set(10, 18, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.4);
    fill.position.set(-8, 10, -8);
    scene.add(fill);
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);
    camera.position.set(0, 24, 34);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    rebuildFloor(scene, selectedFloor);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshesRef.current);
      setHovered(hits.length > 0 ? hits[0].object.userData : null);
      renderer.domElement.style.cursor = hits.length > 0 ? "pointer" : "default";
      if (isDraggingRef.current) {
        rotYRef.current += (e.clientX - lastXRef.current) * 0.007;
        lastXRef.current = e.clientX;
      }
    };
    const onMouseDown = (e: MouseEvent) => { isDraggingRef.current = true; lastXRef.current = e.clientX; isRotatingRef.current = false; setIsRotating(false); };
    const onMouseUp   = ()  => { isDraggingRef.current = false; };
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshesRef.current);
      if (hits.length > 0) setSelected(hits[0].object.userData);
    };

    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("click", onClick);
    window.addEventListener("mouseup", onMouseUp);

    let t = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.016;
      pulsesRef.current.forEach((p: any) => {
        const s = 1 + Math.abs(Math.sin(t * 1.5 + p.userData.phase)) * 1.4;
        p.scale.set(s, s, s);
        p.material.opacity = 0.7 - Math.abs(Math.sin(t * 1.5 + p.userData.phase)) * 0.6;
      });
      if (isRotatingRef.current) rotYRef.current += 0.004;
      const r = 34;
      camera.position.x = Math.sin(rotYRef.current) * r;
      camera.position.z = Math.cos(rotYRef.current) * r;
      camera.position.y = 24;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) rebuildFloor(sceneRef.current, selectedFloor);
  }, [selectedFloor, rebuildFloor]);

  if (!hospitalData || !Array.isArray(hospitalData.floors) || hospitalData.floors.length === 0) return null;

  // Clamp in case selectedFloor is out of range
  const floorIdx     = Math.min(selectedFloor, hospitalData.floors.length - 1);
  const currentFloor = hospitalData.floors[floorIdx];
  if (!currentFloor) return null;

  const zones         = Array.isArray(currentFloor.zones) ? currentFloor.zones : [];
  const totalDevices  = zones.reduce((a:any, z:any) => a + (z.devices?.length ?? 0), 0);
  const onlineDevices = zones.reduce((a:any, z:any) => a + (z.devices?.filter((d:any) => d.status === "ONLINE").length ?? 0), 0);
  const theme = FLOOR_THEMES[floorIdx % FLOOR_THEMES.length];

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "var(--color-background-tertiary)", borderRadius: 16, overflow: "hidden", border: "0.5px solid var(--color-border-tertiary)" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--color-background-primary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏥</div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14, color: "var(--color-text-primary)" }}>{hospitalData.name}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>3D Floor Map · {zones.length} zones · Floor theme: {theme.name}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", background: "var(--color-background-secondary)", padding: "4px 10px", borderRadius: 20, border: "0.5px solid var(--color-border-tertiary)" }}>
            <span style={{ color: "#1D9E75", fontWeight: 500 }}>{onlineDevices}</span>/{totalDevices} online
          </div>
          <button
            onClick={() => { isRotatingRef.current = !isRotatingRef.current; setIsRotating(r => !r); }}
            style={{ fontSize: 12, color: isRotating ? "var(--color-text-info)" : "var(--color-text-secondary)", background: "var(--color-background-secondary)", padding: "4px 10px", borderRadius: 20, border: "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}>
            {isRotating ? "⏸ Pause" : "▶ Rotate"}
          </button>
        </div>
      </div>

      {/* Floor tabs */}
      <div style={{ display: "flex", overflowX: "auto", padding: "0 20px", background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        {hospitalData.floors.map((f:any, i:number) => (
          <button key={i} onClick={() => setSelectedFloor(i)}
            style={{ whiteSpace: "nowrap", padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", background: "none", border: "none",
              borderBottom: selectedFloor === i ? `2px solid #${FLOOR_THEMES[i % FLOOR_THEMES.length].accentColor.toString(16)}` : "2px solid transparent",
              color: selectedFloor === i ? `#${FLOOR_THEMES[i % FLOOR_THEMES.length].accentColor.toString(16)}` : "var(--color-text-secondary)" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Viewport */}
      <div style={{ position: "relative" }}>
        <div ref={mountRef} style={{ width: "100%", height: 520 }} />

        {/* Room type legend */}
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 3, maxHeight: 480, overflowY: "auto" }}>
          {zones.map((z:any, zi:any) => {
            const type = classifyRoom(z.name, z.devices?.length ?? 2);
            const color = roomColor(z.name, z.devices?.length ?? 2);
            return (
              <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--color-text-secondary)", background: "var(--color-background-primary)", padding: "2px 7px", borderRadius: 5, border: "0.5px solid var(--color-border-tertiary)", opacity: 0.92 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: `#${color.toString(16).padStart(6, "0")}`, display: "inline-block", flexShrink: 0 }} />
                {z.name}
              </div>
            );
          })}
        </div>

        {/* Status legend */}
        <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 8 }}>
          {[["#1D9E75", "Online"], ["#888888", "Offline"], ["#FF2222", "Alert"]].map(([c, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-text-secondary)", background: "var(--color-background-primary)", padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block" }} />
              {label}
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", bottom: 12, right: 12, fontSize: 11, color: "var(--color-text-tertiary)", background: "var(--color-background-primary)", padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)" }}>
          Drag to rotate · Click to inspect
        </div>

        {hovered && (
          <div style={{ position: "absolute", left: mousePos.x + 14, top: mousePos.y - 44, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: "7px 12px", fontSize: 12, pointerEvents: "none", zIndex: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
            <div style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{hovered.name}</div>
            <div style={{ color: "var(--color-text-secondary)", marginTop: 2 }}>{hovered.detail}</div>
          </div>
        )}
      </div>

      {selected && (
        <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: selected.status === "ONLINE" ? "#1D9E75" : "#E24B4A" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 13, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{selected.detail} · {selected.type}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {selected.type === "device" && selected.deviceId && (
              <a
                href={`/devices?highlight=${selected.deviceId}`}
                style={{ fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)", cursor: "pointer", color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}
              >
                <span style={{ fontSize: 13 }}>↗</span> View device
              </a>
            )}
            <button onClick={() => setSelected(null)} style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", background: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}