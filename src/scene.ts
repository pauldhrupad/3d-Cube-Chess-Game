import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { N, RT, DN, squarePos, FACE_NAMES, FACE_LABELS, key, type Sq, type Piece, type PieceType, type FaceId } from "./game/engine";
import plasterUrl from "./assets/plaster.jpg";

export interface PlacedPiece {
  sq: Sq;
  piece: Piece;
}
export interface Target {
  sq: Sq;
  capture: boolean;
}

export interface SceneApi {
  sync(list: PlacedPiece[]): void;
  setTargets(targets: Target[], selected: Sq | null): void;
  setCheck(sq: Sq | null): void;
  fly(pieceId: number, path: Sq[], done: () => void): void;
  dispose(): void;
}

const BONE = 0xefe8d8;
const STONE = 0xb7a98e;

/** upright geometry (local +Y = face normal) */
function basisQuat(f: FaceId) {
  const x = new THREE.Vector3(...RT[f]);
  const y = new THREE.Vector3(...N[f]);
  const z = new THREE.Vector3(...DN[f]);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** flat geometry lying on the face (local +Z = face normal) */
function flatQuat(f: FaceId) {
  const x = new THREE.Vector3(...DN[f]);
  const y = new THREE.Vector3(...RT[f]);
  const z = new THREE.Vector3(...N[f]);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function labelSprite(text: string, sub: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 512, 256);
  g.fillStyle = "rgba(23,20,15,0.85)";
  g.font = "700 118px 'IBM Plex Mono', monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 96);
  g.fillStyle = "rgba(23,20,15,0.5)";
  g.font = "500 52px 'IBM Plex Mono', monospace";
  g.fillText(sub, 256, 186);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.62 });
  const s = new THREE.Sprite(m);
  s.scale.set(2.7, 1.35, 1);
  return s;
}

export function createScene(
  container: HTMLElement,
  onPick: (sq: Sq) => void,
  onHover: (sq: Sq | null) => void,
): SceneApi {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
  renderer.setClearAlpha(0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 220);
  camera.position.set(13.5, 11.5, 17);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.minDistance = 13;
  controls.maxDistance = 56;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = Math.PI - 0.18;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.7;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.3;

  /* ------------------------------ light ------------------------------ */
  scene.add(new THREE.HemisphereLight(0xfff2df, 0x7d705c, 1.05));

  const key1 = new THREE.DirectionalLight(0xfff0da, 2.5);
  key1.position.set(14, 19, 11);
  key1.castShadow = true;
  key1.shadow.mapSize.set(2048, 2048);
  key1.shadow.camera.near = 2;
  key1.shadow.camera.far = 70;
  const d = 17;
  key1.shadow.camera.left = -d;
  key1.shadow.camera.right = d;
  key1.shadow.camera.top = d;
  key1.shadow.camera.bottom = -d;
  key1.shadow.bias = -0.0012;
  key1.shadow.normalBias = 0.035;
  scene.add(key1);

  const fill = new THREE.DirectionalLight(0xb9cdf5, 0.85);
  fill.position.set(-16, 7, -12);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffd6a4, 0.7);
  rim.position.set(-8, -11, 13);
  scene.add(rim);

  /* ------------------------------ ground ------------------------------ */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.ShadowMaterial({ opacity: 0.3, color: 0x2b2418 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -7.4;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ------------------------------ cube body ------------------------------ */
  const body = new THREE.Mesh(new THREE.BoxGeometry(8.02, 8.02, 8.02), new THREE.MeshStandardMaterial({
    color: 0x2a241b,
    roughness: 0.92,
    metalness: 0.02,
  }));
  body.castShadow = true;
  body.receiveShadow = true;
  scene.add(body);

  const loader = new THREE.TextureLoader();
  const plaster = loader.load(plasterUrl);
  plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping;
  plaster.repeat.set(2, 2);
  plaster.colorSpace = THREE.SRGBColorSpace;

  const matLight = new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.86, metalness: 0.0, map: plaster });
  const matDark = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.9, metalness: 0.0, map: plaster });

  const tileGeo = new THREE.BoxGeometry(0.965, 0.16, 0.965);
  const tiles: THREE.Mesh[] = [];
  const tileGroup = new THREE.Group();
  scene.add(tileGroup);

  for (let f = 0; f < 6; f++) {
    const q = basisQuat(f as FaceId);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq: Sq = { f: f as FaceId, r, c };
        const m = new THREE.Mesh(tileGeo, (r + c) % 2 === 0 ? matLight : matDark);
        const p = squarePos(sq, 0.08);
        m.position.set(p[0], p[1], p[2]);
        m.quaternion.copy(q);
        m.receiveShadow = true;
        m.userData.key = key(sq);
        tileGroup.add(m);
        tiles.push(m);
      }
    }
  }

  // corner nodes — machined studs at the eight vertices
  const studGeo = new THREE.SphereGeometry(0.34, 20, 14);
  const studMat = new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.55, metalness: 0.25 });
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const s = new THREE.Mesh(studGeo, studMat);
        s.position.set(sx * 4.15, sy * 4.15, sz * 4.15);
        s.castShadow = true;
        scene.add(s);
      }

  // face labels floating off each face
  for (let f = 0; f < 6; f++) {
    const sp = labelSprite(FACE_NAMES[f], FACE_LABELS[f]);
    const n = N[f];
    sp.position.set(n[0] * 6.1, n[1] * 6.1, n[2] * 6.1);
    scene.add(sp);
  }

  /* ------------------------------ pieces ------------------------------ */
  const pieceRoot = new THREE.Group();
  scene.add(pieceRoot);
  const groups = new Map<number, THREE.Group>();
  const matCache = new Map<string, THREE.Material>();
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.62, metalness: 0.18 });

  function mat(color: string) {
    let m = matCache.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.52, metalness: 0.08 });
      matCache.set(color, m);
    }
    return m;
  }

  function buildPiece(type: PieceType, color: string): THREE.Group {
    const g = new THREE.Group();
    const body = mat(color);
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, x = 0, z = 0, ry = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    add(new THREE.CylinderGeometry(0.35, 0.4, 0.13, 26), darkMat, 0.065);
    if (type === "P") {
      add(new THREE.CylinderGeometry(0.27, 0.31, 0.32, 26), body, 0.28);
      add(new THREE.SphereGeometry(0.19, 20, 14), body, 0.5);
    } else if (type === "R") {
      add(new THREE.BoxGeometry(0.56, 0.52, 0.56), body, 0.39);
      add(new THREE.BoxGeometry(0.7, 0.13, 0.7), body, 0.71);
    } else if (type === "N") {
      add(new THREE.BoxGeometry(0.5, 0.32, 0.5), body, 0.29);
      const stem = add(new THREE.BoxGeometry(0.31, 0.66, 0.31), body, 0.72, 0.13, -0.1);
      stem.rotation.x = -0.16;
    } else if (type === "B") {
      add(new THREE.CylinderGeometry(0.19, 0.24, 0.26, 20), body, 0.26);
      add(new THREE.OctahedronGeometry(0.44, 0), body, 0.72);
    } else if (type === "Q") {
      add(new THREE.CylinderGeometry(0.21, 0.27, 0.32, 22), body, 0.29);
      add(new THREE.TorusGeometry(0.29, 0.075, 12, 28), body, 0.5, 0, 0, 0);
      g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      add(new THREE.SphereGeometry(0.33, 26, 18), body, 0.83);
    } else {
      add(new THREE.BoxGeometry(0.52, 0.5, 0.52), body, 0.38);
      add(new THREE.ConeGeometry(0.38, 0.46, 4), body, 0.86, 0, 0, Math.PI / 4);
    }
    return g;
  }

  function place(g: THREE.Group, sq: Sq, lift = 0.16) {
    const p = squarePos(sq, lift);
    g.position.set(p[0], p[1], p[2]);
    g.quaternion.copy(basisQuat(sq.f));
  }

  /* ------------------------------ markers ------------------------------ */
  const markerRoot = new THREE.Group();
  scene.add(markerRoot);
  const accMat = new THREE.MeshBasicMaterial({ color: 0xd6402c, transparent: true, opacity: 0.92, depthWrite: false });
  const accRingMat = new THREE.MeshBasicMaterial({ color: 0xd6402c, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  const dotGeo = new THREE.CircleGeometry(0.2, 26);
  const ringGeo = new THREE.RingGeometry(0.33, 0.47, 30);
  const selGeo = new THREE.RingGeometry(0.5, 0.63, 36);

  const checkRing = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.72, 36), new THREE.MeshBasicMaterial({
    color: 0xd6402c,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));
  checkRing.visible = false;
  scene.add(checkRing);

  function surf(sq: Sq, h: number, geo: THREE.BufferGeometry, m: THREE.Material) {
    const mesh = new THREE.Mesh(geo, m);
    const p = squarePos(sq, h);
    mesh.position.set(p[0], p[1], p[2]);
    mesh.quaternion.copy(flatQuat(sq.f));
    mesh.renderOrder = 5;
    return mesh;
  }

  /* ------------------------------ interaction ------------------------------ */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt: { x: number; y: number } | null = null;
  let lastHover: Sq | null = null;

  function toNdc(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pick(e: PointerEvent): Sq | null {
    toNdc(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(tiles, false);
    if (!hits.length) return null;
    const k = hits[0].object.userData.key as number;
    return { f: Math.floor(k / 64) as FaceId, r: Math.floor((k % 64) / 8), c: k % 8 };
  }

  const onPointerDown = (e: PointerEvent) => {
    downAt = { x: e.clientX, y: e.clientY };
    idle = 0;
    controls.autoRotate = false;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return;
    const sq = pick(e);
    if (sq) onPick(sq);
  };
  const onPointerMove = (e: PointerEvent) => {
    const sq = pick(e);
    const changed = (sq?.f !== lastHover?.f || sq?.r !== lastHover?.r || sq?.c !== lastHover?.c) || (sq === null) !== (lastHover === null);
    if (changed) {
      lastHover = sq;
      onHover(sq);
      renderer.domElement.style.cursor = sq ? "pointer" : "default";
    }
    idle = 0;
  };

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", () => {
    lastHover = null;
    onHover(null);
  });

  /* ------------------------------ loop ------------------------------ */
  let idle = 0;
  let raf = 0;
  let flying: {
    g: THREE.Group;
    pts: THREE.Vector3[];
    t: number;
    dur: number;
    done: () => void;
  } | null = null;

  const clock = new THREE.Clock();
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.06);
    idle += dt;
    if (!reduced && idle > 7 && !flying) controls.autoRotate = true;

    if (flying) {
      flying.t += dt * 1000;
      const raw = Math.min(1, flying.t / flying.dur);
      const e = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      const pts = flying.pts;
      const seg = (pts.length - 1) * e;
      const i = Math.min(pts.length - 2, Math.floor(seg));
      const f = seg - i;
      const p = pts[i].clone().lerp(pts[i + 1], f);
      const lift = Math.sin(raw * Math.PI) * 1.15;
      if (p.lengthSq() > 0.001) p.addScaledVector(p.clone().normalize(), lift);
      flying.g.position.copy(p);
      if (raw >= 1) {
        const cb = flying.done;
        flying = null;
        cb();
      }
    }

    if (checkRing.visible) {
      const s = 1 + Math.sin(clock.elapsedTime * 4.2) * 0.075;
      checkRing.scale.set(s, s, s);
    }

    controls.update();
    renderer.render(scene, camera);
  }
  frame();

  /* ------------------------------ resize ------------------------------ */
  let fittedAspect = 0;
  const resize = () => {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // keep the whole object — studs and floating face labels included — in frame
    if (Math.abs(camera.aspect - fittedAspect) > 0.25) {
      fittedAspect = camera.aspect;
      const half = 8.1;
      const t = Math.tan((camera.fov * Math.PI) / 360);
      const dist = Math.max(half / t, half / (t * Math.max(0.5, camera.aspect)));
      camera.position.setLength(dist);
    }
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  /* ------------------------------ api ------------------------------ */
  return {
    sync(list) {
      const seen = new Set<number>();
      for (const { sq, piece } of list) {
        seen.add(piece.id);
        let g = groups.get(piece.id);
        if (!g) {
          const seatColor = pieceColor(piece);
          g = buildPiece(piece.type, seatColor);
          groups.set(piece.id, g);
          pieceRoot.add(g);
          place(g, sq);
        } else {
          const needType = g.userData.type as PieceType | undefined;
          if (needType !== piece.type) {
            pieceRoot.remove(g);
            g = buildPiece(piece.type, pieceColor(piece));
            groups.set(piece.id, g);
            pieceRoot.add(g);
          }
          if (!flying || flying.g !== g) place(g, sq);
        }
        g.userData.type = piece.type;
      }
      for (const [id, g] of [...groups]) {
        if (!seen.has(id)) {
          pieceRoot.remove(g);
          groups.delete(id);
        }
      }
    },
    setTargets(targets, selected) {
      while (markerRoot.children.length) {
        const c = markerRoot.children.pop() as THREE.Mesh;
        c.geometry.dispose();
      }
      if (selected) markerRoot.add(surf(selected, 0.19, selGeo.clone(), accRingMat));
      for (const t of targets) {
        markerRoot.add(
          surf(t.sq, 0.19, t.capture ? ringGeo.clone() : dotGeo.clone(), t.capture ? accRingMat : accMat),
        );
      }
    },
    setCheck(sq) {
      if (!sq) {
        checkRing.visible = false;
        return;
      }
      const p = squarePos(sq, 0.21);
      checkRing.position.set(p[0], p[1], p[2]);
      checkRing.quaternion.copy(flatQuat(sq.f));
      checkRing.visible = true;
    },
    fly(pieceId, path, done) {
      const g = groups.get(pieceId);
      if (!g || path.length === 0) {
        done();
        return;
      }
      const pts = path.map((s) => {
        const p = squarePos(s, 0.16);
        return new THREE.Vector3(p[0], p[1], p[2]);
      });
      if (pts.length < 2) pts.unshift(g.position.clone());
      flying = { g, pts, t: 0, dur: 300 + path.length * 60, done };
      idle = 0;
      controls.autoRotate = false;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
    },
  };
}

const seatColors = new Map<number, string>();
export function registerSeatColor(index: number, color: string) {
  seatColors.set(index, color);
}
function pieceColor(piece: Piece) {
  return seatColors.get(piece.player) ?? "#D6402C";
}
