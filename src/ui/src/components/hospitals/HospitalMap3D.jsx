
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

const HOSPITAL_DATA = {
  name: "Main Hospital",
  floors: [
    {
      level: 0,
      label: "Ground Floor",
      zones: [
        {
          id: "z1", name: "ICU – Intensive Care", type: "icu",
          x: -5, z: -3, w: 5, d: 4,
          color: 0xe05252, devices: [
            { id: "d1", name: "Monitor ICU-1", status: "ONLINE", x: -4.2, z: -2.2 },
            { id: "d2", name: "Monitor ICU-2", status: "ONLINE", x: -2.8, z: -2.2 },
            { id: "d3", name: "Monitor ICU-3", status: "OFFLINE", x: -1.8, z: -4.2 },
          ]
        },
        {
          id: "z2", name: "Emergency – Trauma", type: "emergency",
          x: 1, z: -3, w: 5, d: 4,
          color: 0xe07d35, devices: [
            { id: "d4", name: "Monitor ER-1", status: "ONLINE", x: 1.8, z: -2.2 },
            { id: "d5", name: "Monitor ER-2", status: "ONLINE", x: 3.2, z: -4.2 },
          ]
        },
        {
          id: "z3", name: "Cardiology – Heart", type: "cardiology",
          x: -5, z: 2, w: 5, d: 4,
          color: 0x5a8ae0, devices: [
            { id: "d6", name: "Monitor Cardio-1", status: "ONLINE", x: -4.2, z: 2.8 },
            { id: "d7", name: "Monitor Cardio-2", status: "OFFLINE", x: -2.8, z: 4.2 },
          ]
        },
        {
          id: "z4", name: "General – Ward", type: "general",
          x: 1, z: 2, w: 5, d: 4,
          color: 0x4eb88a, devices: [
            { id: "d8", name: "Monitor Ward-1", status: "ONLINE", x: 1.8, z: 2.8 },
            { id: "d9", name: "Monitor Ward-2", status: "ONLINE", x: 3.2, z: 4.2 },
          ]
        },
      ]
    },
    {
      level: 1,
      label: "Floor 1",
      zones: [
        {
          id: "z5", name: "Neurology – Brain", type: "neuro",
          x: -5, z: -3, w: 5, d: 4,
          color: 0x9b59b6, devices: [
            { id: "d10", name: "Monitor Neuro-1", status: "ONLINE", x: -4.2, z: -2.2 },
            { id: "d11", name: "Monitor Neuro-2", status: "ONLINE", x: -2.8, z: -4.2 },
          ]
        },
        {
          id: "z6", name: "Orthopedics – Bones", type: "ortho",
          x: 1, z: -3, w: 5, d: 4,
          color: 0x2ecc71, devices: [
            { id: "d12", name: "Monitor Ortho-1", status: "OFFLINE", x: 1.8, z: -2.2 },
            { id: "d13", name: "Monitor Ortho-2", status: "ONLINE", x: 3.2, z: -4.2 },
          ]
        },
      ]
    }
  ]
};

const ZONE_ICONS = {
  icu: "🫀", emergency: "🚨", cardiology: "❤️",
  general: "🏥", neuro: "🧠", ortho: "🦴"
};

export default function HospitalMap3D({ hospitalData = HOSPITAL_DATA }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const frameRef = useRef(null);
  const meshesRef = useRef([]);
  const pulsesRef = useRef([]);
  const floorGroupsRef = useRef([]);
  const isRotatingRef = useRef(true);

  const [selectedFloor, setSelectedFloor] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isRotating, setIsRotating] = useState(true);
  const rotYRef = useRef(0.3);
  const isDraggingRef = useRef(false);
  const lastXRef = useRef(0);

  function addHospitalDetails(group) {
    // ── Receptionist desk ──────────────────────────────────────────
    // Desk body
    const deskGeo = new THREE.BoxGeometry(2.2, 0.65, 0.7);
    const deskMat = new THREE.MeshLambertMaterial({ color: 0xc8b89a });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.set(0, 0.37, -4.8);
    desk.castShadow = true;
    group.add(desk);

    // Desk top
    const topGeo = new THREE.BoxGeometry(2.3, 0.07, 0.8);
    const topMat = new THREE.MeshLambertMaterial({ color: 0xd4c4aa });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(0, 0.72, -4.8);
    group.add(top);

    // Monitor on desk
    const monBodyGeo = new THREE.BoxGeometry(0.5, 0.38, 0.06);
    const monBodyMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const monBody = new THREE.Mesh(monBodyGeo, monBodyMat);
    monBody.position.set(-0.3, 1.02, -4.95);
    group.add(monBody);
    const monScreenGeo = new THREE.BoxGeometry(0.44, 0.32, 0.02);
    const monScreenMat = new THREE.MeshLambertMaterial({ color: 0x1a3a5c });
    const monScreen = new THREE.Mesh(monScreenGeo, monScreenMat);
    monScreen.position.set(-0.3, 1.02, -4.92);
    group.add(monScreen);

    // Receptionist (simple human figure)
    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.6, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a7bd5 }); // blue uniform
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0.5, 1.12, -4.5);
    group.add(body);
    // Head
    const headGeo = new THREE.SphereGeometry(0.13, 10, 10);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xf0c090 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0.5, 1.56, -4.5);
    group.add(head);
    // Hair
    const hairGeo = new THREE.SphereGeometry(0.135, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x3d2b1a });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0.5, 1.59, -4.5);
    group.add(hair);

    // ── Potted trees / plants ──────────────────────────────────────
    [[-5.5, -5.2], [5.5, -5.2], [-5.5, 5.2], [5.5, 5.2]].forEach(([px, pz]) => {
      // Pot
      const potGeo = new THREE.CylinderGeometry(0.18, 0.13, 0.3, 10);
      const potMat = new THREE.MeshLambertMaterial({ color: 0xa0522d });
      const pot = new THREE.Mesh(potGeo, potMat);
      pot.position.set(px, 0.22, pz);
      group.add(pot);
      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.55, 8);
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(px, 0.65, pz);
      group.add(trunk);
      // Foliage — three stacked spheres for volume
      [[0, 0.95, 0, 0.32], [0.15, 1.15, 0.1, 0.24], [-0.1, 1.18, -0.08, 0.22]].forEach(([ox, oy, oz, r]) => {
        const leafGeo = new THREE.SphereGeometry(r, 9, 9);
        const leafMat = new THREE.MeshLambertMaterial({ color: 0x2d7a3a });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(px + ox, oy, pz + oz);
        group.add(leaf);
      });
    });

    // ── Waiting chairs along corridor ─────────────────────────────
    [[-2.5, 0], [-1.2, 0], [1.2, 0], [2.5, 0]].forEach(([cx, cz]) => {
      // Seat
      const seatGeo = new THREE.BoxGeometry(0.44, 0.07, 0.44);
      const seatMat = new THREE.MeshLambertMaterial({ color: 0x4a90d9 });
      const seat = new THREE.Mesh(seatGeo, seatMat);
      seat.position.set(cx, 0.42, cz);
      group.add(seat);
      // Legs
      [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([lx, lz]) => {
        const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6);
        const legMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(cx + lx, 0.21, cz + lz);
        group.add(leg);
      });
      // Backrest
      const backGeo = new THREE.BoxGeometry(0.44, 0.36, 0.06);
      const backMat = new THREE.MeshLambertMaterial({ color: 0x4a90d9 });
      const back = new THREE.Mesh(backGeo, backMat);
      back.position.set(cx, 0.65, cz - 0.19);
      group.add(back);
    });

    // ── Floor directional arrows ───────────────────────────────────
    [-3, 3].forEach((ax) => {
      const arrowCanvas = document.createElement("canvas");
      arrowCanvas.width = 64; arrowCanvas.height = 64;
      const ac = arrowCanvas.getContext("2d");
      ac.fillStyle = "rgba(0,0,0,0)";
      ac.fillRect(0, 0, 64, 64);
      ac.fillStyle = "#aaaaaa";
      ac.beginPath();
      ac.moveTo(32, 8); ac.lineTo(52, 40); ac.lineTo(38, 40);
      ac.lineTo(38, 56); ac.lineTo(26, 56); ac.lineTo(26, 40);
      ac.lineTo(12, 40); ac.closePath();
      ac.fill();
      const atex = new THREE.CanvasTexture(arrowCanvas);
      const arrowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.5),
        new THREE.MeshBasicMaterial({ map: atex, transparent: true, depthWrite: false })
      );
      arrowMesh.rotation.x = -Math.PI / 2;
      arrowMesh.position.set(ax, 0.1, 0);
      group.add(arrowMesh);
    });
  }

  const buildScene = useCallback((scene, floor) => {
    meshesRef.current = [];
    pulsesRef.current = [];
    floorGroupsRef.current.forEach(g => scene.remove(g));
    floorGroupsRef.current = [];

    const floorData = hospitalData.floors[floor];
    const group = new THREE.Group();

    // Base floor slab
    const slabGeo = new THREE.BoxGeometry(14, 0.18, 12);
    const slabMat = new THREE.MeshLambertMaterial({ color: 0xf0ece4 });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.receiveShadow = true;
    group.add(slab);

    // // Ceiling tiles grid
    // for (let xi = -6; xi <= 6; xi += 2) {
    //   for (let zi = -5; zi <= 5; zi += 2) {
    //     const tileGeo = new THREE.BoxGeometry(1.95, 0.04, 1.95);
    //     const tileMat = new THREE.MeshLambertMaterial({ color: 0xfaf9f6 });
    //     const tile = new THREE.Mesh(tileGeo, tileMat);
    //     tile.position.set(xi, 2.8, zi);
    //     group.add(tile);
    //   }
    // }

    // Outer walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xd8d2c5, transparent: true, opacity: 0.55 });
    const wallH = 0.5;
    [
      { geo: [14, wallH, 0.2], pos: [0, wallH / 2, -6] },
      { geo: [14, wallH, 0.2], pos: [0, wallH / 2, 6] },
      { geo: [0.2, wallH, 12], pos: [-7, wallH / 2, 0] },
      { geo: [0.2, wallH, 12], pos: [7, wallH / 2, 0] },
    ].forEach(({ geo, pos }) => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(...geo), wallMat);
      w.position.set(...pos);
      w.castShadow = true;
      group.add(w);
    });

    // Corridor — central H-shape
    const corridorMat = new THREE.MeshLambertMaterial({ color: 0xe8e3d8 });
    [[14, 0.05, 1.2, 0, 0.1, 0], [1.2, 0.05, 12, 0, 0.1, 0]].forEach(([w, h, d, x, y, z]) => {
      const corridor = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), corridorMat);
      corridor.position.set(x, y, z);
      group.add(corridor);
    });

    floorData.zones.forEach((zone) => {
      const cx = zone.x + zone.w / 2;
      const cz = zone.z + zone.d / 2;

      // Zone floor with slight tint
      const zoneFloorGeo = new THREE.BoxGeometry(zone.w - 0.15, 0.06, zone.d - 0.15);
      const zoneFloorMat = new THREE.MeshLambertMaterial({
        color: zone.color, transparent: true, opacity: 0.18
      });
      const zoneFloor = new THREE.Mesh(zoneFloorGeo, zoneFloorMat);
      zoneFloor.position.set(cx, 0.12, cz);
      zoneFloor.userData = { type: "zone", zoneId: zone.id, name: zone.name, detail: `${zone.devices.length} devices` };
      group.add(zoneFloor);
      meshesRef.current.push(zoneFloor);

      // Zone walls (partial — open towards corridor)
      const zwMat = new THREE.MeshLambertMaterial({ color: zone.color, transparent: true, opacity: 0.35 });
      const wallH2 = 1;
      [
        { geo: [zone.w, wallH2, 0.12], pos: [cx, wallH2 / 2, zone.z] },
        { geo: [zone.w, wallH2, 0.12], pos: [cx, wallH2 / 2, zone.z + zone.d] },
        { geo: [0.12, wallH2, zone.d], pos: [zone.x, wallH2 / 2, cz] },
        { geo: [0.12, wallH2, zone.d], pos: [zone.x + zone.w, wallH2 / 2, cz] },
      ].forEach(({ geo, pos }) => {
        const zw = new THREE.Mesh(new THREE.BoxGeometry(...geo), zwMat);
        zw.position.set(...pos);
        group.add(zw);
      });

      // Zone label plane
      const canvas = document.createElement("canvas");
      canvas.width = 320; canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 320, 64);
      ctx.font = "bold 16px system-ui";
      ctx.fillStyle = `#${zone.color.toString(16).padStart(6, "0")}`;
      ctx.textAlign = "center";
      ctx.fillText(zone.name, 160, 38);
      const tex = new THREE.CanvasTexture(canvas);
      const labelMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 0.64),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
      );
      labelMesh.rotation.x = -Math.PI / 2;
      labelMesh.position.set(cx, 0.2, cz + zone.d / 2 - 0.6);
      group.add(labelMesh);

      // Devices
      zone.devices.forEach((dev) => {
        // Monitor body
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.65, 0.3);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2c2c2a });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(dev.x, 0.42, dev.z);
        body.castShadow = true;
        body.userData = { type: "device", deviceId: dev.id, name: dev.name, detail: `${dev.status}`, status: dev.status };
        group.add(body);
        meshesRef.current.push(body);

        // Screen
        const screenGeo = new THREE.BoxGeometry(0.36, 0.26, 0.02);
        const screenColor = dev.status === "ONLINE" ? 0x0d4f38 : 0x3d1010;
        const screenMat = new THREE.MeshLambertMaterial({ color: screenColor });
        const screen = new THREE.Mesh(screenGeo, screenMat);
        screen.position.set(dev.x, 0.56, dev.z - 0.16);
        group.add(screen);

        // Screen glow lines (fake ECG)
        if (dev.status === "ONLINE") {
          const lineCanvas = document.createElement("canvas");
          lineCanvas.width = 64; lineCanvas.height = 32;
          const lctx = lineCanvas.getContext("2d");
          lctx.fillStyle = "#0d4f38";
          lctx.fillRect(0, 0, 64, 32);
          lctx.strokeStyle = "#5DCAA5";
          lctx.lineWidth = 1.5;
          lctx.beginPath();
          for (let i = 0; i < 64; i++) {
            const y = 16 + Math.sin(i * 0.4) * 6 + (Math.random() - 0.5) * 2;
            i === 0 ? lctx.moveTo(i, y) : lctx.lineTo(i, y);
          }
          lctx.stroke();
          const ltex = new THREE.CanvasTexture(lineCanvas);
          const screenFace = new THREE.Mesh(
            new THREE.PlaneGeometry(0.34, 0.24),
            new THREE.MeshBasicMaterial({ map: ltex })
          );
          screenFace.position.set(dev.x, 0.56, dev.z - 0.164);
          group.add(screenFace);
        }

        // Stand
        const standGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.15, 8);
        const standMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.set(dev.x, 0.085, dev.z);
        group.add(stand);

        // Status indicator
        const dotGeo = new THREE.SphereGeometry(0.06, 10, 10);
        const dotColor = dev.status === "ONLINE" ? 0x1D9E75 : 0xE24B4A;
        const dotMat = new THREE.MeshBasicMaterial({ color: dotColor });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(dev.x + 0.18, 0.8, dev.z);
        group.add(dot);

        if (dev.status === "ONLINE") {
          // Pulse ring
          const ringGeo = new THREE.RingGeometry(0.07, 0.12, 16);
          const ringMat = new THREE.MeshBasicMaterial({ color: 0x1D9E75, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.set(dev.x + 0.18, 0.81, dev.z);
          ring.rotation.x = -Math.PI / 2;
          ring.userData.isPulse = true;
          ring.userData.phase = Math.random() * Math.PI * 2;
          ring.userData.baseScale = 1;
          group.add(ring);
          pulsesRef.current.push(ring);
        }
      });

      // Beds (visual detail)
      const bedPositions = zone.devices.length > 2
        ? [[cx - 1, cz - 0.5], [cx + 0.5, cz - 0.5], [cx - 1, cz + 1.2], [cx + 0.5, cz + 1.2]]
        : [[cx - 0.8, cz + 0.2], [cx + 0.8, cz + 0.2]];
      bedPositions.forEach(([bx, bz]) => {
        const bedGeo = new THREE.BoxGeometry(0.7, 0.22, 1.6);
        const bedMat = new THREE.MeshLambertMaterial({ color: 0xeeeae0 });
        const bed = new THREE.Mesh(bedGeo, bedMat);
        bed.position.set(bx, 0.2, bz);
        group.add(bed);

        const pillowGeo = new THREE.BoxGeometry(0.55, 0.1, 0.3);
        const pillowMat = new THREE.MeshLambertMaterial({ color: 0xfaf8f2 });
        const pillow = new THREE.Mesh(pillowGeo, pillowMat);
        pillow.position.set(bx, 0.33, bz - 0.6);
        group.add(pillow);
      });
    });

    addHospitalDetails(group);

    scene.add(group);
    floorGroupsRef.current.push(group);
  }, [hospitalData]);

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
    sceneRef.current = scene;

    // Fog for depth
    scene.fog = new THREE.FogExp2(0xf0ece4, 0.035);

    // Lighting
    scene.add(new THREE.AmbientLight(0xfff8f0, 0.75));
    const sun = new THREE.DirectionalLight(0xfff8e8, 1.1);
    sun.position.set(8, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.4);
    fill.position.set(-6, 8, -6);
    scene.add(fill);

    // Camera
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 200);
    camera.position.set(0, 13, 18);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    buildScene(scene, selectedFloor);

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshesRef.current);
      if (hits.length > 0) {
        const obj = hits[0].object;
        setHovered({ name: obj.userData.name, detail: obj.userData.detail, type: obj.userData.type });
        renderer.domElement.style.cursor = "pointer";
      } else {
        setHovered(null);
        renderer.domElement.style.cursor = "default";
      }
      if (isDraggingRef.current) {
        rotYRef.current += (e.clientX - lastXRef.current) * 0.007;
        lastXRef.current = e.clientX;
      }
    };
    const onMouseDown = (e) => { isDraggingRef.current = true; lastXRef.current = e.clientX; setIsRotating(false); };
    const onMouseUp = () => { isDraggingRef.current = false; };
    const onClick = (e) => {
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

      pulsesRef.current.forEach((p) => {
        const s = 1 + Math.abs(Math.sin(t * 1.5 + p.userData.phase)) * 1.4;
        p.scale.set(s, s, s);
        p.material.opacity = 0.7 - Math.abs(Math.sin(t * 1.5 + p.userData.phase)) * 0.6;
      });

      if (!isDraggingRef.current && isRotatingRef.current) {
        rotYRef.current += 0.004;
      }

      const r = 18;
      camera.position.x = Math.sin(rotYRef.current) * r;
      camera.position.z = Math.cos(rotYRef.current) * r;
      camera.position.y = 13;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) buildScene(sceneRef.current, selectedFloor);
  }, [selectedFloor, buildScene]);

  const currentFloor = hospitalData.floors[selectedFloor];
  const totalDevices = currentFloor.zones.reduce((a, z) => a + z.devices.length, 0);
  const onlineDevices = currentFloor.zones.reduce((a, z) => a + z.devices.filter(d => d.status === "ONLINE").length, 0);
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "var(--color-background-tertiary)", borderRadius: 16, padding: 0, overflow: "hidden", border: "0.5px solid var(--color-border-tertiary)" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--color-background-primary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏥</div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14, color: "var(--color-text-primary)" }}>{hospitalData.name}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>3D Floor Map</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", background: "var(--color-background-secondary)", padding: "4px 10px", borderRadius: 20, border: "0.5px solid var(--color-border-tertiary)" }}>
            <span style={{ color: "#1D9E75", fontWeight: 500 }}>{onlineDevices}</span>/{totalDevices} online
          </div>
          <button
            onClick={() => {
              setIsRotating(r => {
                isRotatingRef.current = !r;
                return !r;
              });
            }}
            style={{ fontSize: 12, color: isRotating ? "var(--color-text-info)" : "var(--color-text-secondary)", background: "var(--color-background-secondary)", padding: "4px 10px", borderRadius: 20, border: "0.5px solid var(--color-border-tertiary)", cursor: "pointer" }}
          >
            {isRotating ? "⏸ Pause" : "▶ Rotate"}
          </button>
        </div>
      </div>

      {/* Floor tabs */}
      <div style={{ display: "flex", gap: 0, padding: "0 20px", background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        {hospitalData.floors.map((f, i) => (
          <button
            key={i}
            onClick={() => setSelectedFloor(i)}
            style={{
              padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", background: "none", border: "none",
              borderBottom: selectedFloor === i ? "2px solid var(--color-text-info)" : "2px solid transparent",
              color: selectedFloor === i ? "var(--color-text-info)" : "var(--color-text-secondary)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 3D viewport */}
      <div style={{ position: "relative" }}>
        <div ref={mountRef} style={{ width: "100%", height: 480 }} />

        {/* Zone legend */}
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {currentFloor.zones.map(z => (
            <div key={z.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-text-secondary)", background: "var(--color-background-primary)", padding: "3px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", opacity: 0.9 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: `#${z.color.toString(16).padStart(6, "0")}`, display: "inline-block", opacity: 0.7 }}></span>
              {ZONE_ICONS[z.type]} {z.name}
            </div>
          ))}
        </div>

        {/* Device status legend */}
        <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 8 }}>
          {[["#1D9E75", "Online"], ["#E24B4A", "Offline"]].map(([c, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-text-secondary)", background: "var(--color-background-primary)", padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block" }}></span>
              {label}
            </div>
          ))}
        </div>

        {/* Rotate hint */}
        <div style={{ position: "absolute", bottom: 12, right: 12, fontSize: 11, color: "var(--color-text-tertiary)", background: "var(--color-background-primary)", padding: "4px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)" }}>
          Drag to rotate
        </div>

        {/* Hover tooltip */}
        {hovered && (
          <div style={{
            position: "absolute", left: mousePos.x + 14, top: mousePos.y - 44,
            background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: 8, padding: "7px 12px", fontSize: 12, pointerEvents: "none", zIndex: 10,
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)"
          }}>
            <div style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{hovered.name}</div>
            <div style={{ color: "var(--color-text-secondary)", marginTop: 2 }}>{hovered.detail}</div>
          </div>
        )}
      </div>

      {/* Selected panel */}
      {selected && (
        <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-primary)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: selected.status === "ONLINE" ? "#1D9E75" : "#E24B4A" }}></div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13, color: "var(--color-text-primary)" }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{selected.detail} · {selected.type}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selected.type === "device" && (
              <button
                onClick={() => sendPrompt(`Show me sensor readings for ${selected.name}`)}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)", cursor: "pointer", color: "var(--color-text-primary)" }}
              >
                View sensors ↗
              </button>
            )}
            <button
              onClick={() => setSelected(null)}
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "0.5px solid var(--color-border-tertiary)", background: "none", cursor: "pointer", color: "var(--color-text-secondary)" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
