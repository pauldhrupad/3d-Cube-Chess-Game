# 4D Chess — Chess on a Cube

Six faces. 384 squares. Every edge is another route.

4D Chess is a browser-based chess variant played on the surface of a 3D cube. Pieces cross the folds between six 8×8 boards, turning familiar moves into attacks from unexpected directions. Play a two-player match, team up for four-player chess, or hand seats to the CPU.

The name is **4D Chess**; the board is a three-dimensional cube, with movement along its surface.

## Features

- **Two-player mode:** Vermilion on the top face versus Ultramarine on the bottom.
- **Four-player mode:** Team Warm (Vermilion and Ochre) versus Team Cool (Ultramarine and Green).
- **Optional CPU seats:** Toggle individual players or use **Solo vs CPU** to control Vermilion while the other seats play automatically.
- **Interactive 3D board:** Orbit, zoom, and follow animated moves across cube faces.
- **Move guidance:** Highlighted legal destinations, capture rings, check indicators, and a move history with face-square notation.
- **Bauhaus-inspired visuals:** Geometric pieces, plaster textures, and a warm, restrained palette inspired by Josef Hartwig's chess set.

## Run locally

Requires Node.js **20.19+ within the 20.x release line, or 22.12+**, npm, and a browser with WebGL support.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## How to play

1. Choose **TWO** or **FOUR** players. Changing modes starts a new game.
2. Leave seats human-controlled for local pass-and-play, or toggle their **CPU** buttons. **Solo vs CPU** starts a fresh game with the other seats automated.
3. Drag the cube to orbit and scroll to zoom.
4. Click a piece belonging to the current player, then click a highlighted destination. Dots indicate moves; rings indicate captures.
5. Open **Rules of the fold** for the in-game guide. After a match, select **Play again** to restart.

## Rules of the fold

Each player starts with 16 pieces near the rim of their home face. Moves can cross an edge onto a neighbouring face, folding around the cube rather than stopping at the board's boundary.

| Mode | Team Warm | Team Cool |
| --- | --- | --- |
| Two players | Vermilion — Top | Ultramarine — Bottom |
| Four players | Vermilion — Top; Ochre — Front | Ultramarine — Bottom; Green — Back |

- Turns follow Vermilion → Ultramarine → Ochre → Green in four-player mode, skipping eliminated players.
- Teammates cannot capture one another. Legal moves must leave every surviving king on the moving team safe.
- Pawns advance along the surface, capture diagonally, and may move two squares on their first move from their starting square.
- Pawns automatically promote to queens when they reach the face opposite their home face.
- A player with no legal move when their turn arrives is eliminated, and their remaining pieces are removed. This applies to both checkmate and stalemate.
- A team wins when the opposing team has no surviving players.

Notation combines a face letter with a square, such as `U-a8` or `F-c1`. Faces are `U` (top), `D` (bottom), `F` (front), `B` (back), `L` (left), and `R` (right).

### Current scope

This is a custom chess variant rather than a complete implementation of standard chess rules. Sliding moves are currently capped at 12 steps per direction. Castling, en passant, underpromotion, and standard repetition or move-count draws are not implemented. CPU players use a lightweight move-scoring heuristic.

Games run locally in the browser. There is no online multiplayer or saved-game persistence; refreshing the page starts over.

## Build and preview

```sh
npm run build
npm run preview
```

The production build is written to `dist/`. Vite's single-file plugin embeds the JavaScript, CSS, and imported image assets into `dist/index.html`. Deploy the contents of `dist/` to a static host. The page requests its fonts from Google Fonts.

## Built with

React 19, TypeScript, Three.js, Tailwind CSS 4, and Vite 7.

| File | Purpose |
| --- | --- |
| `src/App.tsx` | Game interface, player controls, and turn flow |
| `src/game/engine.ts` | Cube geometry, move generation, team rules, and CPU moves |
| `src/scene.ts` | Three.js rendering, camera controls, picking, and animations |
| `src/index.css` | Typography, layout, and visual styling |
| `vite.config.ts` | Development and single-file build configuration |
