import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Game,
  FACE_NAMES,
  FACE_LABELS,
  keyToSq,
  squareName,
  pieceName,
  type Piece,
  type Mode,
  type Sq,
} from "./game/engine";
import { createScene, registerSeatColor, type SceneApi, type Target } from "./scene";
import { CubeMark } from "./ui/CubeMark";
import studioUrl from "./assets/studio.jpg";

interface Toast {
  id: number;
  text: string;
  tone: string;
}

const RULES: { h: string; b: string }[] = [
  {
    h: "THE BOARD",
    b: "Six faces, sixty-four squares each — three hundred and eighty-four squares in all. There is no edge you cannot cross: a piece that reaches the rim of a face folds ninety degrees and keeps going on the neighbouring face.",
  },
  {
    h: "TWO PLAYERS",
    b: "Vermilion takes the top face, Ultramarine takes the bottom. Opposite faces, one shared horizon, one long march between them.",
  },
  {
    h: "FOUR PLAYERS",
    b: "Two teams of two. Team Warm holds the top and front faces; Team Cool holds bottom and back. Teammates may never capture one another. The team that loses both of its armies is out.",
  },
  {
    h: "SILENT COORDINATION",
    b: "Turn order alternates teams. If your partner is checked, they move after you — your move is the only conversation the two of you get.",
  },
  {
    h: "CHECK & ELIMINATION",
    b: "You may never end a move with your own king in check. A player with no legal move is swept from the board along with every piece they own. Lose both players and the team is finished.",
  },
  {
    h: "PROMOTION",
    b: "A pawn promotes the instant it reaches any square on the face opposite its home face — nine long strides from the rim where it started.",
  },
];

const PIECE_ROWS: [string, string][] = [
  ["PAWN", "One square forward, two from its home face. Captures one square diagonally. Promotes on the far face."],
  ["KNIGHT", "One face plus two, in an L. The only piece that jumps — and it jumps over the edge just as easily."],
  ["BISHOP", "Any number of squares diagonally, crossing as many cube edges as the line allows."],
  ["ROOK", "Any number of squares along rank or file, wrapping around the corner without slowing."],
  ["QUEEN", "Rook and bishop together. The only piece that can circle the whole cube."],
  ["KING", "One square in any direction. Never steps into danger."],
];

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneApi | null>(null);
  const gameRef = useRef<Game | null>(null);
  const pickRef = useRef<(sq: Sq) => void>(() => {});
  const hoverRef = useRef<(sq: Sq | null) => void>(() => {});
  const busyRef = useRef(false);

  const [mode, setMode] = useState<Mode>("4p");
  const [v, setV] = useState(0);
  const [selected, setSelected] = useState<Sq | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cpuAll, setCpuAll] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);

  const game = gameRef.current;
  const seats = game?.seats ?? [];
  const currentSeat = game && !game.over ? game.currentSeat : null;

  /* ------------------------------ new game ------------------------------ */
  const newGame = useCallback(
    (m: Mode, cpus: boolean[]) => {
      const g = new Game(m);
      g.seats.forEach((s, i) => {
        s.cpu = cpus[i] ?? false;
        registerSeatColor(s.index, s.color);
      });
      gameRef.current = g;
      busyRef.current = false;
      setSelected(null);
      setTargets([]);
      sceneRef.current?.setCheck(null);
      setV((x) => x + 1);
      setToast({ id: Date.now(), text: m === "2p" ? "TWO PLAYERS · TOP versus BOTTOM" : "FOUR PLAYERS · TEAM WARM versus TEAM COOL", tone: "#17140F" });
    },
    [],
  );

  useEffect(() => {
    const cpus = [false, false, false, false].map((_, i) => cpuAll && i > 0);
    newGame(mode, cpus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cpuAll]);

  /* ------------------------------ scene ------------------------------ */
  useEffect(() => {
    if (!mountRef.current) return;
    let api: SceneApi;
    try {
      api = createScene(
        mountRef.current,
        (sq) => pickRef.current(sq),
        (sq) => hoverRef.current(sq),
      );
    } catch {
      setSceneError("This browser could not start WebGL, so the cube cannot be drawn.");
      return;
    }
    sceneRef.current = api;
    return () => {
      api.dispose();
      sceneRef.current = null;
    };
  }, []);

  /* ------------------------------ selection ------------------------------ */
  const collect = (g: Game): { sq: Sq; piece: Piece }[] => {
    const out: { sq: Sq; piece: Piece }[] = [];
    for (const [k, piece] of g.board) out.push({ sq: keyToSq(k), piece });
    return out;
  };

  const maybeCpu = useCallback(() => {
    const g = gameRef.current;
    const api = sceneRef.current;
    if (!g || !api || g.over) return;
    const seat = g.currentSeat;
    if (!seat.cpu) return;
    busyRef.current = true;
    setV((x) => x + 1);
    window.setTimeout(() => {
      const gg = gameRef.current;
      if (!gg || gg.over) return;
      const mv = gg.cpuMove(gg.currentSeat.index);
      if (!mv) {
        busyRef.current = false;
        return;
      }
      runMove(mv.from, mv.to);
    }, 520);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runMove = useCallback(
    (from: Sq, to: Sq) => {
      const g = gameRef.current;
      const api = sceneRef.current;
      if (!g) return;
      if (!api) {
        const plain = g.play(from, to);
        if (plain) setV((x) => x + 1);
        return;
      }
      const piece = g.get(from);
      if (!piece) return;
      const mover = g.seats[piece.player];
      const taken = g.get(to);
      const mv = g.play(from, to);
      if (!mv) return;
      setSelected(null);
      setTargets([]);
      api.setCheck(null);
      busyRef.current = true;
      setV((x) => x + 1);
      api.sync(collect(g));
      api.fly(piece.id, mv.path, () => {
        api.sync(collect(g));
        busyRef.current = false;
        setV((x) => x + 1);
        const gg = gameRef.current!;
        const fallen = gg.seats.filter((s) => s.justLost);
        if (fallen.length) {
          fallen.forEach((s) => {
            s.justLost = false;
          });
          setToast({
            id: Date.now(),
            text: `${fallen.map((f) => f.name).join(" + ")} SWEPT FROM THE BOARD`,
            tone: "#D6402C",
          });
        } else if (mv.promote) {
          setToast({
            id: Date.now(),
            text: `${mover.name} PAWN PROMOTED ON FACE ${FACE_NAMES[to.f]} — QUEEN`,
            tone: mover.color,
          });
        } else if (taken) {
          setToast({
            id: Date.now(),
            text: `${mover.name} TAKES ${pieceName(taken.type)} ON ${squareName(to)}`,
            tone: mover.color,
          });
        }
        window.setTimeout(() => maybeCpu(), 240);
      });
    },
    [maybeCpu],
  );

  pickRef.current = (sq: Sq) => {
    const g = gameRef.current;
    if (!g || g.over || busyRef.current) return;
    const seat = g.currentSeat;
    if (seat.cpu) return;

    const hit = targets.find((t) => t.sq.f === sq.f && t.sq.r === sq.r && t.sq.c === sq.c);
    if (selected && hit) {
      runMove(selected, sq);
      return;
    }
    const piece = g.get(sq);
    if (piece && piece.player === seat.index) {
      const moves = g.legalMoves(sq);
      setSelected(sq);
      setTargets(moves.map((m) => ({ sq: m.to, capture: !!m.captureId })));
      setV((x) => x + 1);
    } else {
      setSelected(null);
      setTargets([]);
      setV((x) => x + 1);
    }
  };

  hoverRef.current = () => {};

  /* ------------------------------ scene sync ------------------------------ */
  const checkSeat = useMemo(() => {
    if (!game || game.over) return null;
    for (const s of game.seats) {
      if (!s.alive) continue;
      const k = game.kingSquare(s.index);
      if (k && game.isAttacked(k, 1 - s.team)) return s;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, game]);

  useEffect(() => {
    const api = sceneRef.current;
    const g = gameRef.current;
    if (!api || !g) return;
    api.sync(collect(g));
    api.setTargets(targets, selected);
    api.setCheck(checkSeat ? g.kingSquare(checkSeat.index) : null);
  }, [v, selected, targets, checkSeat]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3300);
    return () => window.clearTimeout(t);
  }, [toast]);

  const toggleCpu = (index: number) => {
    const g = gameRef.current;
    if (!g) return;
    g.seats[index].cpu = !g.seats[index].cpu;
    setV((x) => x + 1);
    if (g.seats[index].cpu && g.currentSeat.index === index) maybeCpu();
  };

  /* ------------------------------ render ------------------------------ */
  return (
    <div className="relative h-full w-full overflow-hidden bg-plaster text-ink">
      {/* photographic plaster ground */}
      <div
        className="pointer-events-none fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${studioUrl})` }}
        aria-hidden
      />
      <div className="pointer-events-none fixed inset-0 bg-plaster/62" aria-hidden />
      <div className="grain pointer-events-none fixed inset-0" aria-hidden />

      <div className="relative flex h-full w-full flex-col-reverse lg:flex-row">
        {/* ------------------------------ rail ------------------------------ */}
        <aside className="scroll-thin flex h-[46vh] w-full shrink-0 flex-col overflow-y-auto border-ink/15 bg-plaster/92 lg:h-full lg:w-[356px] lg:border-r">
          <header className="border-b border-ink/15 px-6 pt-6 pb-5">
            <div className="flex items-start gap-3">
              <CubeMark size={46} />
              <div>
                <h1 className="display text-[46px] leading-[0.8]">
                  4D
                  <br />
                  CHESS
                </h1>
              </div>
            </div>
            <p className="label mt-4 text-ink/75">Played on the surface of a cube</p>
            <p className="mt-2 max-w-[30ch] font-mono text-[11px] leading-[1.7] text-ink/78">
              384 squares · 6 faces · no edges, only folds
            </p>
          </header>

          {/* mode */}
          <section className="border-b border-ink/15 px-6 py-5">
            <div className="label text-ink/70">Players</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["2p", "4p"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`group relative border px-3 py-3 text-left transition-colors ${
                    mode === m ? "border-ink bg-ink text-bone" : "border-ink/25 bg-transparent text-ink hover:border-ink/60"
                  }`}
                >
                  <span className="display block text-[21px] leading-none">{m === "2p" ? "TWO" : "FOUR"}</span>
                  <span className="label mt-1.5 block opacity-70">{m === "2p" ? "Opposite faces" : "Teams of two"}</span>
                  {mode === m && <span className="absolute -top-px -right-px h-2.5 w-2.5 bg-vermilion" />}
                </button>
              ))}
            </div>
            <p className="mt-3 font-mono text-[10.5px] leading-[1.75] text-ink/78">
              {mode === "2p"
                ? "TOP versus BOTTOM. One face of empty sky between the two armies."
                : "TEAM WARM holds top + front. TEAM COOL holds bottom + back. Teammates cannot take one another."}
            </p>
          </section>

          {/* seats */}
          <section className="border-b border-ink/15 px-6 py-5">
            <div className="flex items-baseline justify-between">
              <div className="label text-ink/70">Seats</div>
              <button
                onClick={() => setCpuAll((c) => !c)}
                className="label border border-ink/25 px-2 py-1 text-ink/78 transition-colors hover:border-ink hover:text-ink"
              >
                {cpuAll ? "All CPU off" : "Solo vs CPU"}
              </button>
            </div>
            <ul className="mt-3 space-y-px">
              {seats.map((s, i) => {
                const isTurn = currentSeat?.index === s.index;
                const isCheck = checkSeat?.index === s.index;
                const n = game ? game.pieceSquares(s.index).length : 0;
                return (
                  <li
                    key={s.index}
                    className={`flex items-center gap-3 border-l-2 px-3 py-2.5 transition-colors ${
                      isTurn ? "border-l-vermilion bg-ink text-bone" : s.alive ? "border-l-transparent bg-ink/[0.045]" : "border-l-transparent bg-ink/[0.02] opacity-45"
                    }`}
                  >
                    <span
                      className="h-7 w-7 shrink-0 border border-ink/25"
                      style={{ background: s.color }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="display truncate text-[15px] tracking-[-0.01em]">{s.name}</span>
                        {!s.alive && <span className="label text-vermilion">Out</span>}
                        {isCheck && s.alive && <span className="label text-vermilion">Check</span>}
                      </div>
                      <div className={`label mt-0.5 truncate ${isTurn ? "text-bone/82" : "text-ink/70"}`}>
                        {s.team === 0 ? "Team Warm" : "Team Cool"} · Face {FACE_NAMES[s.home]} {FACE_LABELS[s.home]}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`mono text-[11px] ${isTurn ? "text-bone/80" : "text-ink/70"}`}>{n}</span>
                      <button
                        onClick={() => toggleCpu(i)}
                        className={`label border px-1.5 py-1 transition-colors ${
                          s.cpu
                            ? "border-vermilion bg-vermilion text-ink"
                            : isTurn
                              ? "border-bone/35 text-bone/70 hover:border-bone"
                              : "border-ink/25 text-ink/60 hover:border-ink"
                        }`}
                        aria-pressed={s.cpu}
                      >
                        CPU
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex gap-3">
              <div className="flex-1">
                <div className="label text-ink/70">Team Warm</div>
                <div className="mt-1.5 h-1.5 w-full bg-ink/12">
                  <div
                    className="h-full bg-vermilion transition-all duration-500"
                    style={{
                      width: `${(seats.filter((s) => s.team === 0 && s.alive).length / (mode === "2p" ? 1 : 2)) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="label text-ink/70">Team Cool</div>
                <div className="mt-1.5 h-1.5 w-full bg-ink/12">
                  <div
                    className="h-full bg-ultra transition-all duration-500"
                    style={{
                      width: `${(seats.filter((s) => s.team === 1 && s.alive).length / (mode === "2p" ? 1 : 2)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* log */}
          <section className="border-b border-ink/15 px-6 py-5">
            <div className="flex items-baseline justify-between">
              <div className="label text-ink/70">Notation</div>
              <div className="label text-ink/58">Face-square</div>
            </div>
            <div className="mt-3 max-h-[188px] space-y-px overflow-y-auto scroll-thin pr-1">
              {game && game.log.length === 0 && (
                <p className="mono py-3 text-[11px] leading-[1.8] text-ink/62">
                  No moves yet. Select a piece on the cube — legal squares light up in vermilion.
                </p>
              )}
              {game &&
                [...game.log].reverse().map((e) => (
                  <div key={`${e.n}-${e.seat}`} className="mono flex gap-2 text-[10.5px] leading-[1.9]">
                    <span className="w-5 shrink-0 text-ink/58">{String(e.n).padStart(2, "0")}</span>
                    <span className="h-2.5 w-2.5 shrink-0 translate-y-[3px]" style={{ background: e.color }} />
                    <span className={e.check ? "text-vermilion" : e.capture ? "text-ink" : "text-ink/80"}>
                      {e.text}
                      {e.check ? " +" : ""}
                    </span>
                  </div>
                ))}
            </div>
          </section>

          {/* rules */}
          <section className="px-6 py-5">
            <button
              onClick={() => setRulesOpen((o) => !o)}
              className="label flex w-full items-center justify-between border border-ink/25 px-3 py-2.5 transition-colors hover:border-ink"
              aria-expanded={rulesOpen}
            >
              <span>Rules of the fold</span>
              <span className="mono text-[13px] leading-none">{rulesOpen ? "–" : "+"}</span>
            </button>
            {rulesOpen && (
              <div className="rise mt-4 space-y-4">
                {RULES.map((r) => (
                  <div key={r.h}>
                    <h3 className="label text-vermilion">{r.h}</h3>
                    <p className="mt-1.5 text-[12.5px] leading-[1.65] text-ink/88">{r.b}</p>
                  </div>
                ))}
                <div className="border-t border-ink/15 pt-4">
                  <h3 className="label text-ink/70">How each piece travels</h3>
                  <dl className="mt-2.5 space-y-2.5">
                    {PIECE_ROWS.map(([n, d]) => (
                      <div key={n} className="grid grid-cols-[62px_1fr] gap-2">
                        <dt className="label pt-[3px] text-ink">{n}</dt>
                        <dd className="text-[12px] leading-[1.6] text-ink/80">{d}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}
          </section>

          <footer className="mt-auto border-t border-ink/15 px-6 py-4">
            <p className="label text-ink/62">After Josef Hartwig, Bauhaus 1924</p>
          </footer>
        </aside>

        {/* ------------------------------ viewport ------------------------------ */}
        <main className="relative h-[54vh] w-full flex-1 lg:h-full">
          <div ref={mountRef} className="absolute inset-0" />

          {sceneError && (
            <div className="absolute inset-0 flex items-center justify-center px-8">
              <div className="max-w-[420px] border border-ink/20 bg-bone/88 px-8 py-9 text-center">
                <div className="flex justify-center">
                  <CubeMark size={64} />
                </div>
                <h2 className="display mt-5 text-[28px] leading-[0.9]">THE CUBE
                  <br />
                  CANNOT BE DRAWN</h2>
                <p className="mt-4 text-[13px] leading-[1.7] text-ink/78">{sceneError}</p>
                <p className="label mt-4 text-ink/62">
                  The rules, seats and notation still work in the rail
                </p>
              </div>
            </div>
          )}

          {/* turn card */}
          {currentSeat && (
            <div className="pointer-events-none absolute top-3 left-3 flex items-start gap-3 border border-ink/18 bg-bone/82 px-3 py-2.5 backdrop-blur-[3px] lg:top-5 lg:left-5 lg:px-4 lg:py-3">
              <span
                className="mt-0.5 h-11 w-11 shrink-0 border border-ink/25"
                style={{ background: currentSeat.color }}
                aria-hidden
              />
              <div>
                <div className="label text-ink/72">
                  To move · {currentSeat.team === 0 ? "Team Warm" : "Team Cool"}
                </div>
                <div className="display mt-1 text-[26px] leading-none">{currentSeat.name}</div>
                <div className={`label mt-1.5 ${checkSeat?.index === currentSeat.index ? "text-vermilion" : "text-ink/72"}`}>
                  {checkSeat?.index === currentSeat.index
                    ? "King in check — answer it"
                    : `Home face ${FACE_NAMES[currentSeat.home]} · ${FACE_LABELS[currentSeat.home]}`}
                </div>
              </div>
            </div>
          )}

          {/* turn order strip */}
          <div className="pointer-events-none absolute top-5 right-5 hidden border border-ink/18 bg-bone/82 px-3 py-2.5 backdrop-blur-[3px] md:block">
            <div className="label text-ink/70">Turn order</div>
            <div className="mt-2 flex items-center gap-1.5">
              {seats.map((s, i) => (
                <div key={s.index} className="flex items-center gap-1.5">
                  <span
                    className={`h-5 w-5 border transition-all ${
                      currentSeat?.index === s.index ? "scale-110 border-ink" : "border-ink/25"
                    } ${s.alive ? "" : "opacity-25"}`}
                    style={{ background: s.color }}
                  />
                  {i < seats.length - 1 && <span className="h-px w-3 bg-ink/25" />}
                </div>
              ))}
            </div>
            <div className="label mt-2 text-right text-ink/62">
              {mode === "2p" ? "Warm · Cool" : "Warm · Cool · Warm · Cool"}
            </div>
          </div>

          {/* selection readout */}
          <div className="pointer-events-none absolute bottom-5 left-5 hidden border border-ink/18 bg-bone/82 px-4 py-3 backdrop-blur-[3px] sm:block">
            {selected ? (
              <>
                <div className="label text-ink/70">Selected</div>
                <div className="display mt-1 text-[19px] leading-none">{squareName(selected)}</div>
                <div className="label mt-1.5 text-ink/75">
                  {pieceName(game?.get(selected)?.type ?? "P")} · {targets.length} legal {targets.length === 1 ? "square" : "squares"}
                </div>
              </>
            ) : (
              <>
                <div className="label text-ink/70">Controls</div>
                <div className="mono mt-1.5 text-[11px] leading-[1.8] text-ink/80">
                  Drag to orbit · scroll to zoom
                  <br />
                  Click a piece, then a vermilion square
                </div>
              </>
            )}
          </div>

          {/* legend */}
          <div className="pointer-events-none absolute right-5 bottom-5 hidden border border-ink/18 bg-bone/82 px-4 py-3 backdrop-blur-[3px] lg:block">
            <div className="label text-ink/70">Teams</div>
            <div className="mt-2 space-y-1.5">
              {[
                { n: "Team Warm", c: ["#D6402C", "#E9B23C"] },
                { n: "Team Cool", c: ["#24409A", "#1E6B4E"] },
              ].map((t) => (
                <div key={t.n} className="flex items-center gap-2">
                  <span className="flex">
                    {t.c.map((c) => (
                      <span key={c} className="h-3.5 w-3.5 border border-ink/25" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="label text-ink/78">{t.n}</span>
                </div>
              ))}
            </div>
          </div>

          {/* toast */}
          {toast && (
            <div
              key={toast.id}
              className="toast pointer-events-none absolute bottom-24 left-1/2 max-w-[92vw] -translate-x-1/2 border border-ink/20 bg-ink px-5 py-2.5 lg:bottom-auto lg:top-24"
            >
              <span className="label text-bone">{toast.text}</span>
              <span className="ml-3 inline-block h-2.5 w-2.5 translate-y-[1px]" style={{ background: toast.tone }} />
            </div>
          )}

          {/* game over */}
          {game?.over && (
            <div className="absolute inset-0 flex items-center justify-center bg-plaster/86 backdrop-blur-[2px]">
              <div className="rise max-w-[520px] px-8 text-center">
                <div className="label text-ink/70">Game over</div>
                <h2 className="display mt-3 text-[64px] leading-[0.82]">
                  {game.winner === 0 ? "TEAM WARM" : game.winner === 1 ? "TEAM COOL" : "DRAW"}
                  <br />
                  <span className="text-vermilion">WINS</span>
                </h2>
                <p className="mx-auto mt-5 max-w-[38ch] text-[13.5px] leading-[1.7] text-ink/78">
                  {game.winner === 0
                    ? "Vermilion and Ochre hold the cube. The cool armies were swept from their faces one by one."
                    : "Ultramarine and Green hold the cube. The warm armies were swept from their faces one by one."}
                </p>
                <button
                  onClick={() => newGame(mode, seats.map((s) => s.cpu))}
                  className="label mt-7 border border-ink bg-ink px-6 py-3 text-bone transition-colors hover:bg-vermilion hover:border-vermilion hover:text-ink"
                >
                  Play again
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
