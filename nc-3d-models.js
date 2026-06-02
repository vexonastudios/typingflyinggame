// nc-3d-models.js — NERF OPS: Rogue Protocol — 3D Block Model System
// Software 3D renderer for blocky voxel-style enemy models
'use strict';

const Model3D = {
  // ─── 3D Projection Math ──────────────────────────────────────────────────────
  // Projects a 3D point (relative to entity) into screen space
  // entityX/Y = world position, entityAngle = facing direction
  // camX/Y/Angle = camera (player) position/angle
  // W, H = screen dimensions
  project(lx, ly, lz, entityX, entityY, entityAngle, camX, camY, camAngle, camPitch, W, H, fov) {
    // 1. Rotate local point by entity facing angle
    const cosE = Math.cos(entityAngle);
    const sinE = Math.sin(entityAngle);
    const wx = entityX + lx * cosE - ly * sinE;
    const wy = entityY + lx * sinE + ly * cosE;
    const wz = lz;

    // 2. Transform to camera space
    const dx = wx - camX;
    const dy = wy - camY;
    const cosC = Math.cos(-camAngle);
    const sinC = Math.sin(-camAngle);
    const cx = dx * cosC - dy * sinC;
    const cy = dx * sinC + dy * cosC;

    // cx = depth (forward), cy = lateral
    if (cx < 0.05) return null; // behind camera

    // 3. Perspective projection
    const halfFov = fov / 2;
    const focalLen = (W / 2) / Math.tan(halfFov);
    const pitch = camPitch || 0;

    const sx = W / 2 + (cy / cx) * focalLen;
    const sy = H / 2 - (wz / cx) * focalLen + pitch;

    return { sx, sy, depth: cx };
  },

  // ─── Draw a 3D quad face ─────────────────────────────────────────────────────
  drawFace(ctx, pts, color, W, H) {
    if (pts.length < 3) return;
    // All points must be in front of camera
    for (const p of pts) if (!p) return;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].sx, pts[i].sy);
    }
    ctx.closePath();
    ctx.fill();
  },

  // ─── Build a 3D Box (8 vertices, 6 faces) ────────────────────────────────────
  // Returns array of faces: { verts: [indices], color, avgDepth }
  buildBox(x1, x2, y1, y2, z1, z2, baseColor, darken) {
    const d = darken || 1.0;
    // 8 corners
    const verts = [
      [x1, y1, z1], [x2, y1, z1], [x2, y2, z1], [x1, y2, z1], // bottom
      [x1, y1, z2], [x2, y1, z2], [x2, y2, z2], [x1, y2, z2], // top
    ];
    // 6 faces: front, back, left, right, top, bottom
    const faces = [
      { vi: [0, 1, 5, 4], shade: 1.0 * d },   // front (Y-)
      { vi: [2, 3, 7, 6], shade: 0.7 * d },   // back (Y+)
      { vi: [0, 3, 7, 4], shade: 0.85 * d },  // left (X-)
      { vi: [1, 2, 6, 5], shade: 0.85 * d },  // right (X+)
      { vi: [4, 5, 6, 7], shade: 1.15 * d },  // top (Z+)
      { vi: [0, 1, 2, 3], shade: 0.55 * d },  // bottom (Z-)
    ];
    return { verts, faces, baseColor };
  },

  // ─── Shade a hex color ────────────────────────────────────────────────────────
  shade(hex, factor) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, Math.min(255, Math.round(r * factor)));
    g = Math.max(0, Math.min(255, Math.round(g * factor)));
    b = Math.max(0, Math.min(255, Math.round(b * factor)));
    return `rgb(${r},${g},${b})`;
  },

  // ─── Enemy 3D Model Definition ────────────────────────────────────────────────
  // Returns array of boxes for an enemy, given animation state
  // Scale: 1 unit = ~0.5 game tiles. Z is up.
  getEnemyModel(armorColor, accentColor, isCommander, animState, animTime) {
    const boxes = [];
    const S = 0.18; // overall scale

    // Animation offsets
    let legSwing = 0;
    let armSwing = 0;
    let gunLift = 0;
    let bodyBob = 0;
    let muzzleFlash = false;

    if (animState === 'walk') {
      const t = (animTime || 0) * 0.006;
      legSwing = Math.sin(t) * 0.12;
      armSwing = Math.sin(t + Math.PI) * 0.06;
      bodyBob = Math.abs(Math.sin(t * 2)) * 0.02;
    } else if (animState === 'shoot') {
      gunLift = -0.08;
      muzzleFlash = true;
    }

    const headColor = '#e8c8a0';
    const suitColor = '#1a1d22';
    const suitLight = '#2a2d32';
    const bootColor = '#111111';
    const visorColor = accentColor;

    // ─ Legs ─
    // Left leg
    boxes.push(this.buildBox(
      -0.08 * S, -0.01 * S,
      -0.03 * S + legSwing, 0.03 * S + legSwing,
      0, 0.22 * S,
      suitLight
    ));
    // Left boot
    boxes.push(this.buildBox(
      -0.09 * S, 0.0 * S,
      -0.04 * S + legSwing, 0.04 * S + legSwing,
      0, 0.06 * S,
      bootColor
    ));
    // Right leg
    boxes.push(this.buildBox(
      0.01 * S, 0.08 * S,
      -0.03 * S - legSwing, 0.03 * S - legSwing,
      0, 0.22 * S,
      suitColor
    ));
    // Right boot
    boxes.push(this.buildBox(
      0.0 * S, 0.09 * S,
      -0.04 * S - legSwing, 0.04 * S - legSwing,
      0, 0.06 * S,
      bootColor
    ));

    // ─ Torso ─
    boxes.push(this.buildBox(
      -0.10 * S, 0.10 * S,
      -0.05 * S, 0.05 * S,
      0.22 * S + bodyBob, 0.50 * S + bodyBob,
      suitColor
    ));
    // Chest armor plate
    boxes.push(this.buildBox(
      -0.11 * S, 0.11 * S,
      -0.06 * S, -0.02 * S,
      0.28 * S + bodyBob, 0.46 * S + bodyBob,
      armorColor
    ));
    // Back armor plate
    boxes.push(this.buildBox(
      -0.09 * S, 0.09 * S,
      0.02 * S, 0.055 * S,
      0.30 * S + bodyBob, 0.44 * S + bodyBob,
      this.shade(armorColor, 0.7)
    ));
    // Belt
    boxes.push(this.buildBox(
      -0.11 * S, 0.11 * S,
      -0.055 * S, 0.055 * S,
      0.22 * S + bodyBob, 0.26 * S + bodyBob,
      '#333'
    ));

    // Commander insignia
    if (isCommander) {
      boxes.push(this.buildBox(
        -0.03 * S, 0.03 * S,
        -0.065 * S, -0.060 * S,
        0.34 * S + bodyBob, 0.40 * S + bodyBob,
        '#ffd700'
      ));
    }

    // ─ Head ─
    // Neck
    boxes.push(this.buildBox(
      -0.04 * S, 0.04 * S,
      -0.03 * S, 0.03 * S,
      0.50 * S + bodyBob, 0.54 * S + bodyBob,
      headColor
    ));
    // Head/face
    boxes.push(this.buildBox(
      -0.06 * S, 0.06 * S,
      -0.05 * S, 0.05 * S,
      0.54 * S + bodyBob, 0.68 * S + bodyBob,
      headColor
    ));
    // Helmet
    boxes.push(this.buildBox(
      -0.07 * S, 0.07 * S,
      -0.06 * S, 0.06 * S,
      0.62 * S + bodyBob, 0.74 * S + bodyBob,
      armorColor
    ));
    // Visor
    boxes.push(this.buildBox(
      -0.065 * S, 0.065 * S,
      -0.065 * S, -0.055 * S,
      0.58 * S + bodyBob, 0.64 * S + bodyBob,
      visorColor
    ));

    // ─ Left Arm (back arm) ─
    boxes.push(this.buildBox(
      -0.16 * S, -0.10 * S,
      -0.03 * S + armSwing, 0.03 * S + armSwing,
      0.30 * S + bodyBob, 0.48 * S + bodyBob,
      suitLight
    ));
    // Left shoulder pad
    boxes.push(this.buildBox(
      -0.17 * S, -0.10 * S,
      -0.04 * S + armSwing, 0.04 * S + armSwing,
      0.42 * S + bodyBob, 0.50 * S + bodyBob,
      armorColor
    ));

    // ─ Right Arm (gun arm) ─
    boxes.push(this.buildBox(
      0.10 * S, 0.16 * S,
      -0.03 * S - armSwing, 0.03 * S - armSwing,
      0.30 * S + bodyBob + gunLift, 0.48 * S + bodyBob + gunLift,
      suitColor
    ));
    // Right shoulder pad
    boxes.push(this.buildBox(
      0.10 * S, 0.17 * S,
      -0.04 * S - armSwing, 0.04 * S - armSwing,
      0.42 * S + bodyBob + gunLift, 0.50 * S + bodyBob + gunLift,
      armorColor
    ));

    // ─ Blaster Gun ─
    // Gun body
    boxes.push(this.buildBox(
      0.04 * S, 0.20 * S,
      -0.10 * S - armSwing, -0.06 * S - armSwing,
      0.32 * S + bodyBob + gunLift, 0.38 * S + bodyBob + gunLift,
      '#1a1a1a'
    ));
    // Gun barrel
    boxes.push(this.buildBox(
      0.02 * S, 0.05 * S,
      -0.18 * S - armSwing, -0.07 * S - armSwing,
      0.33 * S + bodyBob + gunLift, 0.37 * S + bodyBob + gunLift,
      '#333'
    ));
    // Gun top rail
    boxes.push(this.buildBox(
      0.06 * S, 0.16 * S,
      -0.11 * S - armSwing, -0.08 * S - armSwing,
      0.38 * S + bodyBob + gunLift, 0.40 * S + bodyBob + gunLift,
      '#444'
    ));
    // Energy cell / magazine
    boxes.push(this.buildBox(
      0.10 * S, 0.15 * S,
      -0.12 * S - armSwing, -0.06 * S - armSwing,
      0.26 * S + bodyBob + gunLift, 0.32 * S + bodyBob + gunLift,
      accentColor
    ));

    // ─ Muzzle Flash ─
    if (muzzleFlash) {
      boxes.push(this.buildBox(
        0.0 * S, 0.06 * S,
        -0.24 * S - armSwing, -0.18 * S - armSwing,
        0.30 * S + bodyBob + gunLift, 0.40 * S + bodyBob + gunLift,
        '#ffcc00'
      ));
      boxes.push(this.buildBox(
        0.01 * S, 0.05 * S,
        -0.22 * S - armSwing, -0.19 * S - armSwing,
        0.32 * S + bodyBob + gunLift, 0.38 * S + bodyBob + gunLift,
        '#ffffff'
      ));
    }

    return boxes;
  },

  // ─── Scenery Prop Models ──────────────────────────────────────────────────────
  getSceneryModel(propType) {
    const boxes = [];
    const S = 0.2;

    switch (propType) {
      case 'table':
        // Table top
        boxes.push(this.buildBox(-0.15*S, 0.15*S, -0.10*S, 0.10*S, 0.18*S, 0.20*S, '#8B6914'));
        // Legs
        boxes.push(this.buildBox(-0.13*S, -0.11*S, -0.08*S, -0.06*S, 0, 0.18*S, '#6B4914'));
        boxes.push(this.buildBox(0.11*S, 0.13*S, -0.08*S, -0.06*S, 0, 0.18*S, '#6B4914'));
        boxes.push(this.buildBox(-0.13*S, -0.11*S, 0.06*S, 0.08*S, 0, 0.18*S, '#6B4914'));
        boxes.push(this.buildBox(0.11*S, 0.13*S, 0.06*S, 0.08*S, 0, 0.18*S, '#6B4914'));
        break;

      case 'monitor':
        // Stand base
        boxes.push(this.buildBox(-0.06*S, 0.06*S, -0.04*S, 0.04*S, 0, 0.02*S, '#222'));
        // Stand pole
        boxes.push(this.buildBox(-0.01*S, 0.01*S, -0.01*S, 0.01*S, 0.02*S, 0.14*S, '#333'));
        // Screen
        boxes.push(this.buildBox(-0.10*S, 0.10*S, -0.01*S, 0.01*S, 0.14*S, 0.28*S, '#111'));
        // Screen glow
        boxes.push(this.buildBox(-0.09*S, 0.09*S, -0.015*S, -0.005*S, 0.15*S, 0.27*S, '#1a4a6a'));
        break;

      case 'pillar':
        // Base
        boxes.push(this.buildBox(-0.08*S, 0.08*S, -0.08*S, 0.08*S, 0, 0.04*S, '#555'));
        // Column
        boxes.push(this.buildBox(-0.06*S, 0.06*S, -0.06*S, 0.06*S, 0.04*S, 0.55*S, '#666'));
        // Capital
        boxes.push(this.buildBox(-0.08*S, 0.08*S, -0.08*S, 0.08*S, 0.55*S, 0.60*S, '#555'));
        break;

      case 'locker':
        // Main body
        boxes.push(this.buildBox(-0.06*S, 0.06*S, -0.04*S, 0.04*S, 0, 0.45*S, '#3a5a3a'));
        // Door panel line
        boxes.push(this.buildBox(-0.05*S, 0.05*S, -0.045*S, -0.040*S, 0.04*S, 0.40*S, '#2a4a2a'));
        // Handle
        boxes.push(this.buildBox(0.03*S, 0.04*S, -0.05*S, -0.045*S, 0.22*S, 0.26*S, '#888'));
        break;

      case 'server_rack':
        // Main body
        boxes.push(this.buildBox(-0.06*S, 0.06*S, -0.06*S, 0.06*S, 0, 0.50*S, '#1a1a2a'));
        // LED row 1
        boxes.push(this.buildBox(-0.04*S, 0.04*S, -0.065*S, -0.060*S, 0.10*S, 0.12*S, '#00ff44'));
        // LED row 2
        boxes.push(this.buildBox(-0.04*S, 0.04*S, -0.065*S, -0.060*S, 0.20*S, 0.22*S, '#ff4400'));
        // LED row 3
        boxes.push(this.buildBox(-0.04*S, 0.04*S, -0.065*S, -0.060*S, 0.30*S, 0.32*S, '#00ff44'));
        // Vent top
        boxes.push(this.buildBox(-0.05*S, 0.05*S, -0.065*S, -0.055*S, 0.40*S, 0.48*S, '#222233'));
        break;

      case 'sandbag':
        // Bottom bags
        boxes.push(this.buildBox(-0.12*S, 0.12*S, -0.06*S, 0.06*S, 0, 0.08*S, '#8a7a5a'));
        // Top bag
        boxes.push(this.buildBox(-0.10*S, 0.10*S, -0.05*S, 0.05*S, 0.08*S, 0.14*S, '#9a8a6a'));
        break;

      case 'light_pole':
        // Base
        boxes.push(this.buildBox(-0.03*S, 0.03*S, -0.03*S, 0.03*S, 0, 0.03*S, '#444'));
        // Pole
        boxes.push(this.buildBox(-0.01*S, 0.01*S, -0.01*S, 0.01*S, 0.03*S, 0.55*S, '#555'));
        // Light housing
        boxes.push(this.buildBox(-0.04*S, 0.04*S, -0.02*S, 0.02*S, 0.52*S, 0.58*S, '#333'));
        // Light glow
        boxes.push(this.buildBox(-0.03*S, 0.03*S, -0.015*S, -0.005*S, 0.53*S, 0.57*S, '#ffee88'));
        break;

      case 'ammo_crate':
        // Crate body
        boxes.push(this.buildBox(-0.08*S, 0.08*S, -0.05*S, 0.05*S, 0, 0.12*S, '#4a6a2a'));
        // Lid
        boxes.push(this.buildBox(-0.09*S, 0.09*S, -0.06*S, 0.06*S, 0.12*S, 0.14*S, '#3a5a1a'));
        // Label stripe
        boxes.push(this.buildBox(-0.06*S, 0.06*S, -0.055*S, -0.050*S, 0.04*S, 0.10*S, '#ffcc00'));
        break;
    }

    return boxes;
  },

  // ─── Render a full 3D model ───────────────────────────────────────────────────
  // boxes: array from getEnemyModel or getSceneryModel
  // entityX/Y/Angle: world position and facing
  // cam*: camera params
  // zBuf: per-column depth buffer from raycaster
  renderModel(ctx, boxes, entityX, entityY, entityAngle, camX, camY, camAngle, camPitch, W, H, fov, zBuf, fogDepth) {
    const allFaces = [];

    for (const box of boxes) {
      const projVerts = box.verts.map(v =>
        this.project(v[0], v[1], v[2], entityX, entityY, entityAngle, camX, camY, camAngle, camPitch, W, H, fov)
      );

      for (const face of box.faces) {
        const pts = face.vi.map(i => projVerts[i]);
        // Skip if any vertex is behind camera
        if (pts.some(p => !p)) continue;

        // Average depth for sorting
        const avgDepth = pts.reduce((s, p) => s + p.depth, 0) / pts.length;

        // Back-face culling (check winding order in screen space)
        const a = pts[0], b = pts[1], c = pts[2];
        const cross = (b.sx - a.sx) * (c.sy - a.sy) - (b.sy - a.sy) * (c.sx - a.sx);
        if (cross > 0) continue; // back-facing

        const color = this.shade(box.baseColor, face.shade);
        allFaces.push({ pts, color, avgDepth });
      }
    }

    // Painter's algorithm: sort back-to-front
    allFaces.sort((a, b) => b.avgDepth - a.avgDepth);

    // Draw
    for (const face of allFaces) {
      // Z-buffer check: skip faces behind walls
      const centerX = face.pts.reduce((s, p) => s + p.sx, 0) / face.pts.length;
      const col = Math.floor(centerX);
      if (col >= 0 && col < W && zBuf && face.avgDepth > zBuf[col]) continue;

      // Fog
      const fog = fogDepth ? Math.min(1, face.avgDepth / fogDepth) : 0;
      const fogAlpha = 1 - fog * 0.85;

      ctx.save();
      ctx.globalAlpha = fogAlpha;
      this.drawFace(ctx, face.pts, face.color, W, H);
      ctx.restore();
    }
  }
};
