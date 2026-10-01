/* ------------------------------------------------------------------
   4D CHESS — cube-surface geometry + rules engine
   The board is the surface of a cube: 6 faces x 8 x 8 = 384 squares.
   Pieces move along the surface, folding 90 degrees around cube edges.
------------------------------------------------------------------- */

export type Vec3 = [number, number, number];
export type FaceId = 0 | 1 | 2 | 3 | 4 | 5;
export type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";

export interface Sq {
  f: FaceId;
  r: number;
  c: number;
}

/** U D F B L R */
export const FACE_NAMES = ["U", "D", "F", "B", "L", "R"];
export const FACE_LABELS = ["TOP", "BOTTOM", "FRONT", "BACK", "LEFT", "RIGHT"];

export const N: Vec3[] = [
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
  [-1, 0, 0],
  [1, 0, 0],
];
export const RT: Vec3[] = [
  [1, 0, 0],
  [1, 0, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];
export const DN: Vec3[] = [
  [0, 0, 1],
  [0, 0, -1],
  [0, -1, 0],
  [0, -1, 0],
  [0, -1, 0],
  [0, -1, 0],
];

export const OPPOSITE: FaceId[] = [1, 0, 3, 2, 5, 4];

/** Direction of travel around the great circle U -> F -> D -> B -> U.
 *  On the back face the ring runs the other way through the local grid,
 *  so every pawn marches with RING_SIGN[face] and always reaches the face
 *  opposite the one it was born on. */
export const RING_SIGN: number[] = [1, 1, 1, -1, 1, 1]; // U D F B L R

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 3D point of a square. h = height above the face plane. */
export function squarePos(sq: Sq, h = 0): Vec3 {
  const n = N[sq.f];
  const r = RT[sq.f];
  const d = DN[sq.f];
  const pR = sq.c - 3.5;
  const pD = sq.r - 3.5;
  const nC = 4 + h;
  return [
    n[0] * nC + r[0] * pR + d[0] * pD,
    n[1] * nC + r[1] * pR + d[1] * pD,
    n[2] * nC + r[2] * pR + d[2] * pD,
  ];
}

export function pointToSquare(p: Vec3): Sq {
  let best = 0;
  let bestDot = -Infinity;
  for (let f = 0; f < 6; f++) {
    const v = dot(p, N[f]);
    if (v > bestDot) {
      bestDot = v;
      best = f;
    }
  }
  const r = Math.round(dot(p, DN[best]) + 3.5);
  const c = Math.round(dot(p, RT[best]) + 3.5);
  return { f: best as FaceId, r, c };
}

/** One step along a single axis, folding around the cube edge when needed. */
function stepAxis(sq: Sq, dc: number, dr: number): Sq {
  const pR = sq.c - 3.5 + dc;
  const pD = sq.r - 3.5 + dr;
  if (Math.abs(pR) > 4) {
    const e = Math.abs(pR) - 4;
    const p = scaleAdd(sq.f, 4 - e, Math.sign(pR) * 4, pD);
    return pointToSquare(p);
  }
  if (Math.abs(pD) > 4) {
    const e = Math.abs(pD) - 4;
    const p = scaleAdd(sq.f, 4 - e, pR, Math.sign(pD) * 4);
    return pointToSquare(p);
  }
  return { f: sq.f, r: pD + 3.5, c: pR + 3.5 };
}

function scaleAdd(f: FaceId, nC: number, pR: number, pD: number): Vec3 {
  const n = N[f];
  const r = RT[f];
  const d = DN[f];
  return [
    n[0] * nC + r[0] * pR + d[0] * pD,
    n[1] * nC + r[1] * pR + d[1] * pD,
    n[2] * nC + r[2] * pR + d[2] * pD,
  ];
}

/** Displacement on the folded surface (dc along columns, dr along rows). */
export function advance(sq: Sq, dc: number, dr: number): Sq {
  let s: Sq = { f: sq.f, r: sq.r, c: sq.c };
  for (let i = 0; i < Math.abs(dc); i++) s = stepAxis(s, Math.sign(dc), 0);
  for (let j = 0; j < Math.abs(dr); j++) s = stepAxis(s, 0, Math.sign(dr));
  return s;
}

export const key = (sq: Sq) => sq.f * 64 + sq.r * 8 + sq.c;
export const sameSq = (a: Sq, b: Sq) => a.f === b.f && a.r === b.r && a.c === b.c;

export const FILE = "abcdefgh";
export const squareName = (sq: Sq) => `${FACE_NAMES[sq.f]}-${FILE[sq.c]}${sq.r + 1}`;

/* ---------------------------- pieces ---------------------------- */

export interface Piece {
  id: number;
  type: PieceType;
  player: number;
  team: number;
  home: FaceId;
  forward: 1 | -1;
  moved: boolean;
}

export interface Seat {
  index: number;
  name: string;
  team: 0 | 1;
  home: FaceId;
  forward: 1 | -1;
  color: string;
  dark: string;
  cpu: boolean;
  alive: boolean;
  justLost?: boolean;
}

export interface Move {
  from: Sq;
  to: Sq;
  pieceId: number;
  captureId: number | null;
  promote: boolean;
  path: Sq[];
}

export interface LogEntry {
  n: number;
  seat: number;
  seatName: string;
  color: string;
  text: string;
  capture: boolean;
  check: boolean;
}

export const TEAM_NAMES = ["TEAM WARM", "TEAM COOL"];
export const TEAM_COLORS = ["#D6402C", "#24409A"];

const BACK_RANK: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

const VALUES: Record<PieceType, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 40 };

export type Mode = "2p" | "4p";

export function makeSeats(mode: Mode): Seat[] {
  const base = [
    { name: "VERMILION", color: "#D6402C", dark: "#8E2418", team: 0 as const, home: 0 as FaceId, forward: 1 as const },
    { name: "ULTRAMARINE", color: "#24409A", dark: "#152A66", team: 1 as const, home: 1 as FaceId, forward: 1 as const },
    { name: "OCHRE", color: "#E9B23C", dark: "#A6761D", team: 0 as const, home: 2 as FaceId, forward: 1 as const },
    { name: "GREEN", color: "#1E6B4E", dark: "#12422F", team: 1 as const, home: 3 as FaceId, forward: -1 as const },
  ];
  // 2 players: opposite faces (TOP / BOTTOM)
  // 4 players: the ring TOP / FRONT / BOTTOM / BACK, alternating teams
  const pick = mode === "2p" ? [0, 1] : [0, 1, 2, 3];
  return pick.map((i, idx) => ({ ...base[i], index: idx, cpu: false, alive: true }));
}

export class Game {
  board = new Map<number, Piece>();
  seats: Seat[];
  mode: Mode;
  order: number[];
  turnPos = 0;
  ply = 0;
  log: LogEntry[] = [];
  winner: number | null = null;
  over = false;
  lastMove: Move | null = null;
  private uid = 1;

  constructor(mode: Mode) {
    this.mode = mode;
    this.seats = makeSeats(mode);
    this.order = this.seats.map((s) => s.index);
    this.setup();
  }

  private setup() {
    for (const seat of this.seats) {
      const s = RING_SIGN[seat.home];
      // armies stand at the rim of their face, ready to cross the fold
      const backRow = s > 0 ? 6 : 1;
      const pawnRow = s > 0 ? 7 : 0;
      for (let c = 0; c < 8; c++) {
        this.put({ f: seat.home, r: backRow, c }, BACK_RANK[c], seat);
        this.put({ f: seat.home, r: pawnRow, c }, "P", seat);
      }
    }
  }

  private put(sq: Sq, type: PieceType, seat: Seat) {
    const p: Piece = {
      id: this.uid++,
      type,
      player: seat.index,
      team: seat.team,
      home: seat.home,
      forward: seat.forward,
      moved: false,
    };
    this.board.set(key(sq), p);
    return p;
  }

  get(sq: Sq) {
    return this.board.get(key(sq));
  }

  pieceSquares(player: number): { sq: Sq; piece: Piece }[] {
    const out: { sq: Sq; piece: Piece }[] = [];
    for (const [k, piece] of this.board) {
      if (piece.player !== player) continue;
      out.push({ sq: keyToSq(k), piece });
    }
    return out;
  }

  kingSquare(player: number): Sq | null {
    for (const [k, piece] of this.board) {
      if (piece.player === player && piece.type === "K") return keyToSq(k);
    }
    return null;
  }

  get currentSeat(): Seat {
    return this.seats[this.order[this.turnPos % this.order.length]];
  }

  /* ------------------------ move generation ------------------------ */

  private ray(sq: Sq, dc: number, dr: number, out: Move[], max = 12) {
    const piece = this.get(sq)!;
    const seen = new Set<number>([key(sq)]);
    let cur = sq;
    for (let i = 0; i < max; i++) {
      const next = advance(cur, dc, dr);
      const k = key(next);
      if (seen.has(k)) return;
      seen.add(k);
      const target = this.board.get(k);
      if (target) {
        if (target.team !== piece.team && target.type !== "K") {
          out.push(this.mk(sq, next, target.id));
        }
        return;
      }
      out.push(this.mk(sq, next, null));
      cur = next;
    }
  }

  private mk(from: Sq, to: Sq, captureId: number | null, path?: Sq[]): Move {
    const piece = this.get(from)!;
    const isPromo = piece.type === "P" && to.f === OPPOSITE[piece.home];
    return { from, to, pieceId: piece.id, captureId, promote: isPromo, path: path ?? [] };
  }

  pseudoMoves(sq: Sq): Move[] {
    const piece = this.get(sq);
    if (!piece) return [];
    const out: Move[] = [];

    if (piece.type === "P") {
      const s = RING_SIGN[sq.f];
      const one = advance(sq, 0, s);
      if (!this.board.has(key(one))) {
        out.push(this.mk(sq, one, null));
        const startRow = s > 0 ? 7 : 0;
        if (!piece.moved && sq.r === startRow && sq.f === piece.home) {
          const two = advance(one, 0, s);
          if (!this.board.has(key(two))) out.push(this.mk(sq, two, null));
        }
      }
      for (const dc of [-1, 1]) {
        const cap = advance(sq, dc, s);
        const target = this.board.get(key(cap));
        if (target && target.team !== piece.team && target.type !== "K") {
          out.push(this.mk(sq, cap, target.id));
        }
      }
      return out;
    }

    if (piece.type === "N") {
      for (const [dc, dr] of [
        [1, 2],
        [2, 1],
        [-1, 2],
        [-2, 1],
        [1, -2],
        [2, -1],
        [-1, -2],
        [-2, -1],
      ]) {
        const to = advance(sq, dc, dr);
        const target = this.board.get(key(to));
        if (target && (target.team === piece.team || target.type === "K")) continue;
        out.push(this.mk(sq, to, target ? target.id : null));
      }
      return out;
    }

    const dirs: [number, number][] =
      piece.type === "R"
        ? [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]
        : piece.type === "B"
          ? [
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ]
          : [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ];

    if (piece.type === "R" || piece.type === "B" || piece.type === "Q") {
      for (const [dc, dr] of dirs) this.ray(sq, dc, dr, out);
      return out;
    }

    // king
    for (const [dc, dr] of dirs) {
      const to = advance(sq, dc, dr);
      const target = this.board.get(key(to));
      if (target && (target.team === piece.team || target.type === "K")) continue;
      out.push(this.mk(sq, to, target ? target.id : null));
    }
    return out;
  }

  /** squares attacked by any piece of `team` */
  isAttacked(sq: Sq, team: number): boolean {
    for (const [k, piece] of this.board) {
      if (piece.team !== team) continue;
      const from = keyToSq(k);
      if (this.attacks(from, piece, sq)) return true;
    }
    return false;
  }

  private attacks(from: Sq, piece: Piece, target: Sq): boolean {
    const s = RING_SIGN[from.f];
    if (piece.type === "P") {
      for (const dc of [-1, 1]) {
        const cap = advance(from, dc, s);
        if (cap.f === target.f && cap.r === target.r && cap.c === target.c) return true;
      }
      return false;
    }
    if (piece.type === "N") {
      for (const [dc, dr] of [
        [1, 2],
        [2, 1],
        [-1, 2],
        [-2, 1],
        [1, -2],
        [2, -1],
        [-1, -2],
        [-2, -1],
      ]) {
        const to = advance(from, dc, dr);
        if (to.f === target.f && to.r === target.r && to.c === target.c) return true;
      }
      return false;
    }
    const dirs: [number, number][] =
      piece.type === "R"
        ? [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]
        : piece.type === "B"
          ? [
              [1, 1],
              [1, -1],
              [-1, 1],
              [-1, -1],
            ]
          : piece.type === "K"
            ? [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
              ]
            : [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
              ];
    const seen = new Set<number>([key(from)]);
    let cur = from;
    for (const [dc, dr] of dirs) {
      seen.clear();
      seen.add(key(from));
      cur = from;
      for (let i = 0; i < 12; i++) {
        const next = advance(cur, dc, dr);
        const k = key(next);
        if (seen.has(k)) break;
        seen.add(k);
        if (next.f === target.f && next.r === target.r && next.c === target.c) return true;
        if (this.board.has(k)) break;
        cur = next;
      }
    }
    return false;
  }

  inCheck(team: number): boolean {
    for (const seat of this.seats) {
      if (seat.team !== team || !seat.alive) continue;
      const k = this.kingSquare(seat.index);
      if (!k) continue;
      if (this.isAttacked(k, 1 - team)) return true;
    }
    return false;
  }

  legalMoves(sq: Sq): Move[] {
    const piece = this.get(sq);
    if (!piece) return [];
    const res: Move[] = [];
    for (const mv of this.pseudoMoves(sq)) {
      const captured = mv.captureId ? this.board.get(key(mv.to)) : null;
      const fromPiece = this.board.get(key(mv.from))!;
      this.board.delete(key(mv.from));
      this.board.set(key(mv.to), fromPiece);
      const bad = this.inCheck(piece.team);
      this.board.delete(key(mv.to));
      this.board.set(key(mv.from), fromPiece);
      if (captured) this.board.set(key(mv.to), captured);
      if (!bad) res.push(mv);
    }
    return res;
  }

  allLegalMoves(player: number): Move[] {
    const out: Move[] = [];
    for (const { sq } of this.pieceSquares(player)) out.push(...this.legalMoves(sq));
    return out;
  }

  /** cheap early-exit test used for checkmate / stalemate resolution */
  hasLegalMove(player: number): boolean {
    for (const { sq } of this.pieceSquares(player)) {
      if (this.legalMoves(sq).length > 0) return true;
    }
    return false;
  }

  /** The exact squares a piece glides over, following the folded surface.
   *  Returns the route including the origin square. */
  finalPath(from: Sq, to: Sq, piece: Piece): Sq[] {
    if (piece.type === "N" || piece.type === "K") return [from, to];
    const dirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (const [dc, dr] of dirs) {
      let cur = from;
      const path: Sq[] = [from];
      const seen = new Set<number>([key(from)]);
      for (let i = 0; i < 12; i++) {
        const next = advance(cur, dc, dr);
        const k = key(next);
        if (seen.has(k)) break;
        seen.add(k);
        path.push(next);
        if (next.f === to.f && next.r === to.r && next.c === to.c) return path;
        cur = next;
      }
    }
    return [from, to];
  }

  play(from: Sq, to: Sq): Move | null {
    const piece = this.get(from);
    if (!piece) return null;
    const move = this.legalMoves(from).find((m) => m.to.f === to.f && m.to.r === to.r && m.to.c === to.c);
    if (!move) return null;
    const path = this.finalPath(from, to, piece);

    const captured = move.captureId ? this.board.get(key(to)) : null;
    this.board.delete(key(from));
    this.board.set(key(to), piece);
    piece.moved = true;

    let promoted = false;
    if (piece.type === "P" && to.f === OPPOSITE[piece.home]) {
      piece.type = "Q";
      promoted = true;
    }

    const seat = this.seats[piece.player];
    let text = `${pieceName(move.promote ? "P" : piece.type)} ${squareName(from)}\u2192${squareName(to)}`;
    if (promoted) text += "=Q";
    if (captured) text += `\u00d7${pieceName(captured.type)}`;

    this.ply++;
    this.lastMove = { ...move, path };

    // a player whose army is gone leaves the game at once
    for (const s of this.seats) {
      if (s.alive && this.pieceSquares(s.index).length === 0) s.alive = false;
    }

    const checkNow = this.inCheck(1 - piece.team) && this.seats.some((s) => s.team === 1 - piece.team && s.alive);
    this.log.push({
      n: this.ply,
      seat: seat.index,
      seatName: seat.name,
      color: seat.color,
      text,
      capture: !!captured,
      check: checkNow,
    });
    if (this.log.length > 200) this.log.shift();

    // Advance the turn. A player is only swept when their own turn arrives,
    // which is what gives their partner exactly one move to rescue them.
    let guard = 0;
    while (guard++ < 16) {
      this.turnPos = (this.turnPos + 1) % this.order.length;
      const s = this.seats[this.order[this.turnPos]];
      if (!s.alive) continue;
      if (this.pieceSquares(s.index).length === 0 || !this.hasLegalMove(s.index)) {
        s.alive = false;
        s.justLost = true;
        for (const { sq } of this.pieceSquares(s.index)) this.board.delete(key(sq));
        continue;
      }
      break;
    }

    this.checkGameOver();
    return { ...move, path };
  }

  private checkGameOver() {
    const aliveTeams = new Set<number>();
    for (const s of this.seats) if (s.alive) aliveTeams.add(s.team);
    if (aliveTeams.size === 1) {
      this.winner = [...aliveTeams][0];
      this.over = true;
    } else if (aliveTeams.size === 0) {
      this.over = true;
      this.winner = null;
    }
  }

  /** cheap heuristic for the optional CPU seats */
  cpuMove(player: number): Move | null {
    const moves = this.allLegalMoves(player);
    if (!moves.length) return null;
    let best: Move | null = null;
    let bestScore = -Infinity;
    for (const mv of moves) {
      const piece = this.board.get(key(mv.from))!;
      const target = mv.captureId ? this.board.get(key(mv.to)) : null;
      let score = Math.random() * 1.6;
      if (target) score += VALUES[target.type] * 9;
      if (mv.promote) score += 30;
      // advance toward the far side
      score += (mv.to.r - mv.from.r) * RING_SIGN[mv.from.f] * 0.35;
      // give check
      const saved = this.board.get(key(mv.to));
      this.board.delete(key(mv.from));
      this.board.set(key(mv.to), piece);
      if (this.inCheck(1 - piece.team)) score += 6;
      this.board.delete(key(mv.to));
      this.board.set(key(mv.from), piece);
      if (saved) this.board.set(key(mv.to), saved);
      // centre play
      score += (3.5 - Math.abs(mv.to.c - 3.5)) * 0.12;
      if (score > bestScore) {
        bestScore = score;
        best = mv;
      }
    }
    return best;
  }
}

export function pieceName(t: PieceType) {
  return t === "P"
    ? "PAWN"
    : t === "N"
      ? "KNIGHT"
      : t === "B"
        ? "BISHOP"
        : t === "R"
          ? "ROOK"
          : t === "Q"
            ? "QUEEN"
            : "KING";
}

export function pieceGlyph(t: PieceType) {
  return t;
}

export function keyToSq(k: number): Sq {
  const f = Math.floor(k / 64);
  const rest = k % 64;
  return { f: f as FaceId, r: Math.floor(rest / 8), c: rest % 8 };
}
