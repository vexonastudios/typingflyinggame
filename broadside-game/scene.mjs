import * as THREE from './vendor/three.module.js';
import { BATTERY, SIDES, SIDE_SIGN, batteryBearing, forward, clamp } from './combat.mjs';

const COLORS = { port: 0xf88067, starboard: 0x79e5b7, gold: 0xf3d393 };
const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...extra });
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function beam(parent, from, to, radius, material) {
  const delta = to.clone().sub(from);
  const object = mesh(
    new THREE.CylinderGeometry(radius, radius, delta.length(), 5),
    material,
    parent,
  );
  object.position.copy(from).add(to).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(v3(0, 1, 0), delta.normalize());
  return object;
}
function line(parent, points, color, opacity = 1) {
  const object = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
  );
  parent.add(object);
  return object;
}
function disposeGroup(group) {
  const materials = new Set(),
    geometries = new Set(),
    textures = new Set();
  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of mats)
      if (material) {
        materials.add(material);
        if (material.map) textures.add(material.map);
      }
  });
  textures.forEach((t) => t.dispose());
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  group.clear();
}

function sailTexture(enemy, flagship) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = flagship ? '#3a4245' : '#fff3d6';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = flagship ? '#68685c' : '#dccfb1';
  ctx.lineWidth = 2;
  for (let x = 10; x < 256; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  const color = enemy ? '#aa493d' : '#23776b';
  ctx.fillStyle = color;
  ctx.fillRect(0, 216, 256, 24);
  ctx.fillRect(0, 16, 256, 9);
  ctx.strokeStyle = flagship ? '#e6bd72' : color;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(128, 112, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(128, 73);
  ctx.lineTo(128, 152);
  ctx.moveTo(90, 112);
  ctx.lineTo(166, 112);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(99, 83);
  ctx.lineTo(157, 141);
  ctx.moveTo(157, 83);
  ctx.lineTo(99, 141);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class SeaView {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x479698);
    this.scene.fog = new THREE.FogExp2(0x76babb, 0.0018);
    this.camera = new THREE.OrthographicCamera(-80, 80, 50, -50, 0.1, 650);
    this.camera.position.set(0, 130, 86);
    this.focus = v3(0, 0, 0);
    this.zoom = 1;
    this.time = 0;
    this.shake = 0;
    this.scene.add(new THREE.HemisphereLight(0xdff7ff, 0x235752, 2.5));
    this.sun = new THREE.DirectionalLight(0xffe9c4, 3.2);
    this.sun.position.set(-60, 100, 35);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, {
      left: -90,
      right: 90,
      top: 90,
      bottom: -90,
      near: 1,
      far: 260,
    });
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.15;
    this.scene.add(this.sun, this.sun.target);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.effectsGroup = new THREE.Group();
    this.scene.add(this.effectsGroup);
    this.shotGroup = new THREE.Group();
    this.scene.add(this.shotGroup);
    this.ships = new Map();
    this.shots = new Map();
    this.effects = [];
    this.rings = [];
    this.particleGeometry = new THREE.IcosahedronGeometry(1, 0);
    this.smokeMaterial = mat(0xebded0, { transparent: true, opacity: 0.65, depthWrite: false });
    this.foamMaterial = new THREE.MeshBasicMaterial({
      color: 0xd7f5e8,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.shotGeometry = new THREE.SphereGeometry(0.4, 8, 6);
    this.shotMaterial = mat(0x332a24, { emissive: 0x8f592c, emissiveIntensity: 0.4 });
    this.shotTailGeometry = new THREE.BufferGeometry().setFromPoints([v3(0, 0, 0), v3(0, 0, 1.8)]);
    this.shotTailMaterial = new THREE.LineBasicMaterial({
      color: 0xf4d899,
      transparent: true,
      opacity: 0.6,
    });
    this.buildOcean();
    this.resize();
  }

  buildOcean() {
    this.waterMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, sun: { value: v3(-0.5, 1, 0.3) } },
      vertexShader: `varying vec3 worldPoint; void main() { vec4 w = modelMatrix * vec4(position, 1.0); worldPoint = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        varying vec3 worldPoint; uniform float time;
        void main() {
          vec2 p = worldPoint.xz;
          float a = sin(p.x * .19 + p.y * .14 + time * .65);
          float b = sin(p.x * .35 - p.y * .3 - time * .8);
          float c = sin(p.x * .73 + p.y * .41 + time * 1.2);
          float waves = a * .4 + b * .23 + c * .07;
          vec3 water = mix(vec3(.013, .142, .16), vec3(.022, .18, .19), waves * .5 + .55);
          float ripple = abs(sin(p.x * .16 + p.y * .82 + sin(p.x * .12) * 1.6 + time * .8));
          float crest = (1. - smoothstep(.0, .035, ripple)) * pow(max(0., sin(p.x * .15 + p.y * .09)), 12.);
          water += vec3(.12, .22, .2) * crest * .25;
          gl_FragColor = vec4(water, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), this.waterMaterial);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.08;
    this.scene.add(ocean);
  }

  load(battle) {
    disposeGroup(this.world);
    for (const effect of this.effects) {
      this.effectsGroup.remove(effect.mesh);
      effect.mesh.material.dispose();
    }
    for (const ring of this.rings) {
      this.effectsGroup.remove(ring.mesh);
      ring.mesh.geometry.dispose();
      ring.mesh.material.dispose();
    }
    this.effects = [];
    this.rings = [];
    this.shotGroup.clear();
    this.shots.clear();
    this.ships.clear();
    this.battle = battle;
    const rng = seeded(battle.mission.seed);
    battle.islands.forEach((island, i) => this.buildIsland(island, rng, i === 0));
    battle.ships.forEach((ship) => this.ships.set(ship.id, this.buildShip(ship)));
    this.buildArcs();
    this.focus.set(battle.player.x, 0, battle.player.y - 7);
    this.buildBuoys();
  }

  buildIsland(island, rng, lighthouse) {
    const root = new THREE.Group();
    root.position.set(island.x, 0, island.y);
    this.world.add(root);
    const sand = mat(0xd8c58b),
      rock = mat(0x677673),
      grass = mat(0x557b49);
    mesh(
      new THREE.CylinderGeometry(island.r * 1.13, island.r * 1.3, 0.25, 18),
      mat(0x67bcb1),
      root,
      0,
      -0.05,
    );
    mesh(new THREE.CylinderGeometry(island.r * 0.78, island.r * 1.1, 1.9, 14), sand, root, 0, 0.6);
    mesh(new THREE.CylinderGeometry(island.r * 0.53, island.r * 0.85, 4.6, 10), rock, root, 0, 2.1);
    mesh(
      new THREE.CylinderGeometry(island.r * 0.57, island.r * 0.59, 0.65, 11),
      grass,
      root,
      0,
      4.5,
    );
    for (let j = 0; j < 14; j++) {
      const angle = rng() * Math.PI * 2,
        radius = island.r * (0.45 + rng() * 0.36);
      const r = mesh(
        new THREE.DodecahedronGeometry(1 + rng() * 2, 0),
        rock,
        root,
        Math.cos(angle) * radius,
        1 + rng(),
        Math.sin(angle) * radius,
      );
      r.scale.y = 0.65 + rng();
      r.rotation.set(rng(), rng(), rng());
    }
    const trunk = mat(0x655340),
      leaves = [mat(0x315b3b), mat(0x447244), mat(0x6b8e4a)];
    for (let j = 0; j < 9; j++) {
      const angle = rng() * 6.28,
        radius = rng() * island.r * 0.46;
      const x = Math.cos(angle) * radius,
        z = Math.sin(angle) * radius,
        height = 3 + rng() * 3;
      mesh(new THREE.CylinderGeometry(0.22, 0.4, height, 5), trunk, root, x, 4.8 + height / 2, z);
      mesh(new THREE.IcosahedronGeometry(2.2 + rng(), 0), leaves[j % 3], root, x, 5 + height, z);
    }
    for (let ring = 0; ring < 3; ring++) {
      const foam = new THREE.Mesh(
        new THREE.RingGeometry(
          island.r * (1.12 + ring * 0.09),
          island.r * (1.13 + ring * 0.09),
          60,
        ),
        this.foamMaterial.clone(),
      );
      foam.rotation.x = -Math.PI / 2;
      foam.position.y = 0.04;
      root.add(foam);
    }
    if (lighthouse) {
      const tower = new THREE.Group();
      tower.position.set(-island.r * 0.34, 4.8, island.r * 0.35);
      root.add(tower);
      mesh(new THREE.CylinderGeometry(1.4, 2, 9, 12), mat(0xf0ebd1), tower, 0, 4.5);
      mesh(new THREE.CylinderGeometry(1.48, 1.6, 1.2, 12), mat(0xb45341), tower, 0, 6);
      mesh(new THREE.CylinderGeometry(2, 2, 0.4, 12), rock, tower, 0, 9.1);
      mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 1.8, 8),
        mat(0xf4d884, { emissive: 0xe5ab44, emissiveIntensity: 0.7 }),
        tower,
        0,
        10.2,
      );
      mesh(new THREE.ConeGeometry(2, 1.4, 12), mat(0x3c5354), tower, 0, 11.6);
      const dock = mesh(
        new THREE.BoxGeometry(3, 0.5, 12),
        mat(0x78614a),
        root,
        0,
        0.8,
        island.r + 2,
      );
      for (let i = 0; i < 8; i++)
        line(dock, [v3(-1.45, 0.26, i * 1.5 - 5.5), v3(1.45, 0.26, i * 1.5 - 5.5)], 0x392c26, 0.5);
    }
  }

  buildBuoys() {
    const base = mat(0xe0b769),
      cap = mat(0xc16849);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) {
      const buoy = new THREE.Group();
      buoy.position.set(Math.cos(a) * 137, 0.2, Math.sin(a) * 137);
      mesh(new THREE.CylinderGeometry(0.65, 1, 0.8, 8), base, buoy);
      mesh(new THREE.ConeGeometry(0.4, 1.7, 6), cap, buoy, 0, 1);
      this.world.add(buoy);
    }
  }

  buildShip(ship) {
    const root = new THREE.Group();
    this.world.add(root);
    const hull = new THREE.Group();
    root.add(hull);
    const enemy = ship.team === 'enemy';
    const wood = mat(0x61432f),
      deck = mat(0xb98b53),
      dark = mat(0x302e2b),
      trim = mat(0xd6ae63);
    const paint = mat(enemy ? 0x994236 : 0x245d56);
    const shape = new THREE.Shape();
    shape.moveTo(-1.9, 6);
    shape.lineTo(-2.5, 4);
    shape.lineTo(-2.8, -1.8);
    shape.quadraticCurveTo(-2.7, -4.9, 0, -7.4);
    shape.quadraticCurveTo(2.7, -4.9, 2.8, -1.8);
    shape.lineTo(2.5, 4);
    shape.lineTo(1.9, 6);
    shape.closePath();
    const hullGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: 1.8,
      bevelEnabled: true,
      bevelSize: 0.25,
      bevelThickness: 0.3,
      bevelSegments: 1,
      steps: 1,
      curveSegments: 7,
    });
    hullGeometry.rotateX(Math.PI / 2);
    mesh(hullGeometry, wood, hull, 0, 2.2);
    const lowerHull = mesh(hullGeometry, paint, hull, 0, 1.5);
    lowerHull.scale.set(0.98, 0.35, 0.98);
    const deckGeometry = new THREE.ShapeGeometry(shape, 12);
    deckGeometry.rotateX(Math.PI / 2);
    const deckMesh = mesh(deckGeometry, deck, hull, 0, 2.23);
    deckMesh.material.side = THREE.DoubleSide;
    for (let x = -2; x <= 2; x += 0.5)
      line(hull, [v3(x, 2.25, -4.2), v3(x, 2.25, 5.5)], 0x5d412c, 0.45);
    const rails = shape.getPoints(20).map((p) => v3(p.x, 2.55, p.y));
    line(hull, rails, 0xedd29a);
    for (const sign of [-1, 1]) {
      beam(hull, v3(sign * 2.75, 2.1, -2.7), v3(sign * 2.35, 2.1, 5), 0.14, trim);
      for (let z = -3.8; z < 5.5; z += 1.2)
        beam(hull, v3(sign * 2.45, 2.25, z), v3(sign * 2.45, 2.8, z), 0.055, dark);
    }
    mesh(new THREE.BoxGeometry(3.7, 1.3, 2.4), paint, hull, 0, 2.9, 4.35);
    mesh(new THREE.BoxGeometry(4.2, 0.25, 2.65), deck, hull, 0, 3.7, 4.35);
    for (let x = -1.2; x <= 1.3; x += 0.8)
      mesh(new THREE.BoxGeometry(0.4, 0.48, 0.05), mat(0xeacf8d), hull, x, 2.95, 5.57);
    beam(hull, v3(0, 2.35, -6), v3(0, 4, -10), 0.15, wood);
    const guns = { port: [], starboard: [] };
    for (const side of SIDES) {
      const sign = SIDE_SIGN[side];
      for (let i = 0; i < 5; i++) {
        const z = (i - 2) * 1.7;
        mesh(new THREE.BoxGeometry(0.9, 0.3, 0.7), wood, hull, sign * 2.1, 2.45, z);
        const gun = new THREE.Group();
        gun.position.set(sign * 2.65, 2.8, z);
        hull.add(gun);
        gun.rotation.y = (-sign * (i - 2) * BATTERY.halfArc) / 2;
        const barrel = mesh(new THREE.CylinderGeometry(0.2, 0.29, 1.5, 8), dark, gun);
        barrel.rotation.z = Math.PI / 2;
        const muzzle = mesh(new THREE.TorusGeometry(0.205, 0.055, 5, 8), trim, gun, sign * 0.73);
        muzzle.rotation.y = Math.PI / 2;
        guns[side].push(gun);
      }
    }
    const sails = [];
    const canvas = mat(0xffffff, {
      map: sailTexture(enemy, ship.flagship),
      side: THREE.DoubleSide,
      roughness: 1,
    });
    for (const [z, height, width] of [
      [-2.5, 12.3, 8.5],
      [2.2, 10.8, 7],
    ]) {
      beam(hull, v3(0, 2.3, z), v3(0, height + 1, z), 0.12, wood);
      beam(hull, v3(-width / 2 - 0.3, height, z), v3(width / 2 + 0.3, height, z), 0.09, wood);
      beam(
        hull,
        v3(-width / 2 + 0.15, height - 5.5, z),
        v3(width / 2 - 0.15, height - 5.5, z),
        0.07,
        wood,
      );
      const geometry = new THREE.PlaneGeometry(width, 5.5, 10, 8);
      const pos = geometry.attributes.position;
      for (let i = 0; i < pos.count; i++)
        pos.setZ(
          i,
          Math.cos((pos.getX(i) / width) * Math.PI) * Math.cos((pos.getY(i) / 5.5) * Math.PI) * 1.2,
        );
      geometry.computeVertexNormals();
      const sail = mesh(geometry, canvas, hull, 0, height - 2.75, z);
      sails.push({ mesh: sail, base: height - 2.75, height });
      const ropes = [
        [-2.5, 2.8, z + 1.6],
        [2.5, 2.8, z + 1.6],
        [0, 2.5, z - 3],
      ];
      for (const [x, y, dz] of ropes)
        line(hull, [v3(x, y, dz), v3(0, height + 0.7, z)], 0x6f6657, 0.8);
      const flagGeometry = new THREE.BufferGeometry().setFromPoints([
        v3(0, 0, 0),
        v3(3, -0.4, 0),
        v3(0, -1, 0),
      ]);
      flagGeometry.setIndex([0, 1, 2]);
      flagGeometry.computeVertexNormals();
      mesh(
        flagGeometry,
        mat(enemy ? 0xcc6650 : 0x59b49c, { side: THREE.DoubleSide }),
        hull,
        0,
        height + 1,
        z,
      );
    }
    const jibGeo = new THREE.BufferGeometry().setFromPoints([
      v3(0, 4, -9.3),
      v3(0, 11.3, -2.5),
      v3(0.7, 4.5, -3),
    ]);
    jibGeo.setIndex([0, 1, 2]);
    jibGeo.computeVertexNormals();
    mesh(jibGeo, canvas, hull);
    const crewCoat = mat(enemy ? 0x79372e : 0x2d5160),
      skin = mat(0xd8aa7e);
    for (let i = 0; i < 6; i++) {
      const x = i % 2 ? 1.1 : -1.1,
        z = (Math.floor(i / 2) - 1) * 2.6;
      mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.55, 6), crewCoat, hull, x, 2.55, z);
      mesh(new THREE.SphereGeometry(0.18, 6, 5), skin, hull, x, 3, z);
    }
    if (ship.flagship) hull.scale.setScalar(1.18);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshBasicMaterial({
        color: 0x102f34,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(3.9, 8.7, 1);
    shadow.position.y = 0.03;
    root.add(shadow);
    return { root, hull, sails, guns, lastWake: 0, lastSmoke: 0, dead: false };
  }

  buildArcs() {
    this.arcs = {};
    for (const side of SIDES) {
      const root = new THREE.Group();
      this.world.add(root);
      const sign = SIDE_SIGN[side];
      const sectorPoint = (t, range) => {
        const angle = sign * (Math.PI / 2 + (t * 2 - 1) * BATTERY.halfArc);
        return v3(
          sign * 3.2 + Math.sin(angle) * range,
          0.14,
          (t * 2 - 1) * 3.4 - Math.cos(angle) * range,
        );
      };
      const vertices = [];
      for (let i = 0; i < 30; i++) {
        const a = i / 30,
          b = (i + 1) / 30;
        for (const [t, range] of [
          [a, 1],
          [a, BATTERY.range],
          [b, BATTERY.range],
          [a, 1],
          [b, BATTERY.range],
          [b, 1],
        ])
          vertices.push(...sectorPoint(t, range).toArray());
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const material = new THREE.MeshBasicMaterial({
        color: COLORS[side],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
      });
      root.add(new THREE.Mesh(geo, material));
      const outline = [];
      for (let i = 0; i <= 30; i++) outline.push(sectorPoint(i / 30, BATTERY.range));
      const rim = line(root, outline, COLORS[side], 0.52);
      for (const t of [0, 1])
        line(root, [sectorPoint(t, 1), sectorPoint(t, BATTERY.range)], COLORS[side], 0.42);
      this.arcs[side] = { root, material, rim };
    }
    this.bow = new THREE.Group();
    this.world.add(this.bow);
    line(this.bow, [v3(-1.1, 0.18, -13), v3(0, 0.18, -14.6), v3(1.1, 0.18, -13)], 0xf4e2bb, 0.8);
  }

  particle(x, y, z, color, size, life, vx, vy, vz) {
    if (this.effects.length > 180) return;
    const material = mat(color, { transparent: true, opacity: 0.85, depthWrite: false });
    const object = mesh(this.particleGeometry, material, this.effectsGroup, x, y, z);
    object.castShadow = false;
    object.scale.setScalar(size);
    this.effects.push({ mesh: object, life, maxLife: life, size, vx, vy, vz });
  }

  ring(x, y, radius, life = 0.8, color = 0xd2f7e9) {
    if (this.rings.length > 90) return;
    const object = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 20),
      new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    object.rotation.x = -Math.PI / 2;
    object.position.set(x, 0.16, y);
    object.scale.setScalar(radius);
    this.effectsGroup.add(object);
    this.rings.push({ mesh: object, life, maxLife: life, radius });
  }

  wake(ship) {
    if (this.rings.length > 90) return;
    const f = forward(ship.heading);
    const object = line(
      this.effectsGroup,
      [v3(-1.6, 0, 1.8), v3(0, 0, 0), v3(1.6, 0, 1.8)],
      0xc0ece1,
      0.35,
    );
    object.position.set(ship.x - f.x * 5.4, 0.17, ship.y - f.y * 5.4);
    object.rotation.y = -ship.heading;
    this.rings.push({ mesh: object, life: 2, maxLife: 2, radius: 1 });
  }

  events(events) {
    for (const event of events) {
      if (event.type === 'cannon') {
        const f = forward(event.heading);
        for (let n = 0; n < 5; n++)
          this.particle(
            event.x,
            2.8,
            event.y,
            n === 0 ? 0xffd68e : 0xdbd2bf,
            n === 0 ? 0.6 : 0.45 + n * 0.12,
            0.3 + n * 0.2,
            f.x * (3 + n),
            1 + n * 0.6,
            f.y * (3 + n),
          );
        if (event.ship.team === 'player') this.shake = 0.23;
      }
      if (event.type === 'hit') {
        for (let n = 0; n < 8; n++)
          this.particle(
            event.x,
            2,
            event.y,
            n % 2 ? 0xa87640 : 0xf6cb8b,
            0.15 + n * 0.035,
            0.4 + n * 0.05,
            (Math.random() - 0.5) * 9,
            3 + Math.random() * 4,
            (Math.random() - 0.5) * 9,
          );
        this.ring(event.x, event.y, 1.2, 0.8);
        if (event.ship.team === 'player') this.shake = 0.45;
      }
      if (event.type === 'splash') {
        this.ring(event.x, event.y, 0.7, 0.9);
        for (let n = 0; n < 4; n++)
          this.particle(
            event.x,
            0.2,
            event.y,
            0xc4ece5,
            0.2,
            0.45 + n * 0.07,
            (n - 2) * 1.2,
            3 + n,
            (Math.random() - 0.5) * 3,
          );
      }
      if (event.type === 'sunk') {
        this.ring(event.ship.x, event.ship.y, 4, 2.5);
        for (let n = 0; n < 14; n++)
          this.particle(
            event.ship.x + (Math.random() - 0.5) * 4,
            3,
            event.ship.y + (Math.random() - 0.5) * 6,
            0x9b988a,
            1 + n * 0.09,
            1.5 + Math.random(),
            (Math.random() - 0.5) * 2,
            1.5,
            (Math.random() - 0.5) * 2,
          );
      }
    }
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    const halfHeight =
      (aspect < 0.8 ? Math.max(80, 48 / aspect) : this.height < 550 ? 39 : 54) / this.zoom;
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }

  project(x, y, height = 3) {
    const p = v3(x, height, y).project(this.camera);
    return {
      x: (p.x * 0.5 + 0.5) * this.width,
      y: (-p.y * 0.5 + 0.5) * this.height,
      visible: Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.84,
    };
  }

  render(dt, playing = true, paused = false) {
    if (!this.battle) return;
    const animDt = paused ? 0 : dt;
    this.time += animDt;
    this.waterMaterial.uniforms.time.value = this.time;
    const player = this.battle.player;
    const f = forward(player.heading);
    const target = v3(
      player.x + f.x * 6,
      0,
      player.y + f.y * 6 - (this.width < 600 ? 10 : this.height < 550 ? 8 : 3),
    );
    if (this.width / this.height < 0.8) {
      const enemies = this.battle.ships.filter((ship) => ship.team === 'enemy' && ship.alive);
      const nearest = enemies.sort(
        (a, b) =>
          Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y),
      )[0];
      if (nearest && Math.hypot(nearest.x - player.x, nearest.y - player.y) < 80) {
        target.x = player.x + (nearest.x - player.x) * 0.36;
        target.z += (nearest.y - player.y) * 0.12;
      }
    }
    this.focus.lerp(target, 1 - Math.exp(-dt * 2.5));
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.camera.position.copy(this.focus).add(v3(Math.sin(this.time * 89) * this.shake, 130, 86));
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
    this.sun.position.copy(this.focus).add(v3(-60, 100, 35));
    this.sun.target.position.copy(this.focus);
    for (const ship of this.battle.ships) {
      const visual = this.ships.get(ship.id);
      visual.root.position.set(ship.x, 0, ship.y);
      visual.root.rotation.y = -ship.heading;
      visual.hull.position.y = Math.sin(this.time * 1.8 + ship.id) * 0.13;
      visual.hull.rotation.z =
        Math.sin(this.time * 1.3 + ship.id) * 0.025 + ship.rudder * ship.speed * 0.003;
      visual.hull.rotation.x = Math.sin(this.time * 1.5 + ship.id) * 0.013;
      if (!ship.alive) {
        if (!visual.dead) {
          visual.dead = true;
          visual.sinkTime = this.time;
        }
        const elapsed = this.time - visual.sinkTime;
        visual.root.position.y = -Math.min(16, elapsed * 1.5);
        visual.hull.rotation.z += Math.min(0.65, elapsed * 0.12);
        visual.root.visible = elapsed < 9;
      } else {
        for (const sail of visual.sails) {
          const fill = 0.3 + (ship.sails / 3) * 0.7;
          sail.mesh.scale.y += (fill - sail.mesh.scale.y) * Math.min(1, animDt * 4);
          sail.mesh.position.y = sail.height - 2.75 * sail.mesh.scale.y;
          sail.mesh.rotation.y = Math.sin(this.time * 2 + ship.id) * 0.025;
        }
        for (const side of SIDES)
          visual.guns[side].forEach((gun, i) => {
            gun.position.x = SIDE_SIGN[side] * (2.65 - ship.batteries[side].guns[i].recoil * 0.5);
          });
        if (!paused && ship.speed > 0.7 && this.time - visual.lastWake > 0.18) {
          visual.lastWake = this.time;
          this.wake(ship);
        }
        if (!paused && ship.hp < ship.maxHp * 0.5 && this.time - visual.lastSmoke > 0.7) {
          visual.lastSmoke = this.time;
          this.particle(ship.x, 3, ship.y + 3, 0x747672, 0.6, 2.3, 0.6, 2.4, 0.3);
        }
      }
    }
    for (const side of SIDES) {
      const arc = this.arcs[side];
      arc.root.position.set(player.x, 0, player.y);
      arc.root.rotation.y = -player.heading;
      const ready = player.batteries[side].remaining === 0;
      arc.material.opacity = ready ? 0.075 + Math.sin(this.time * 1.4) * 0.012 : 0.018;
      arc.rim.material.opacity = ready ? 0.6 : 0.12;
      arc.root.visible = player.alive && playing;
    }
    this.bow.position.set(player.x, 0, player.y);
    this.bow.rotation.y = -player.heading;
    this.bow.visible = player.alive;
    const active = new Set();
    for (const shot of this.battle.projectiles) {
      active.add(shot.id);
      let object = this.shots.get(shot.id);
      if (!object) {
        object = new THREE.Group();
        object.add(
          new THREE.Mesh(this.shotGeometry, this.shotMaterial),
          new THREE.Line(this.shotTailGeometry, this.shotTailMaterial),
        );
        this.shotGroup.add(object);
        this.shots.set(shot.id, object);
      }
      object.position.set(
        shot.x,
        2.8 + Math.sin((shot.distance / BATTERY.range) * Math.PI) * 1.4,
        shot.y,
      );
      object.rotation.y = -Math.atan2(shot.x - shot.lastX, shot.lastY - shot.y);
    }
    for (const [id, object] of this.shots)
      if (!active.has(id)) {
        this.shotGroup.remove(object);
        this.shots.delete(id);
      }
    for (const effect of this.effects) {
      effect.life -= animDt;
      effect.mesh.position.addScaledVector(v3(effect.vx, effect.vy, effect.vz), animDt);
      effect.mesh.scale.setScalar(effect.size * (1 + (1 - effect.life / effect.maxLife) * 1.5));
      effect.mesh.material.opacity = Math.max(0, effect.life / effect.maxLife) * 0.7;
      if (effect.life <= 0) {
        this.effectsGroup.remove(effect.mesh);
        effect.mesh.material.dispose();
      }
    }
    this.effects = this.effects.filter((e) => e.life > 0);
    for (const ring of this.rings) {
      ring.life -= animDt;
      const fraction = Math.max(0, ring.life / ring.maxLife);
      ring.mesh.scale.setScalar(ring.radius * (2.5 - fraction * 1.5));
      ring.mesh.material.opacity = fraction * 0.35;
      if (ring.life <= 0) {
        this.effectsGroup.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
      }
    }
    this.rings = this.rings.filter((ring) => ring.life > 0);
    this.renderer.render(this.scene, this.camera);
  }
}
