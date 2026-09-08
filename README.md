# ARKA

A canvas arkanoid. Procedurally generated levels, continuous-collision ball physics, seven
brick types, nine power-ups, parallax backgrounds and dithered gradients. Everything on screen
— including the fonts and the buttons — is drawn by the game into a single `<canvas>`.

Plays with a mouse, a keyboard, or touch.

No sound yet. No save system.

## Run

```sh
yarn install
yarn dev
```

`yarn dev` opens the game in your browser.

## Build

```sh
yarn build      # type-checks, then bundles to dist/
yarn preview    # serve the built bundle
```

## Checks

```sh
yarn typecheck
yarn lint
yarn test
```

## Docker

```sh
docker build -t arka .
docker run --rm -p 8080:80 arka
```

Then open <http://localhost:8080>.

## Controls

| Input | Action |
|---|---|
| Mouse / trackpad | Move the paddle |
| `←` `→` or `A` `D` | Move the paddle |
| `Space` / click | Launch the ball |
| `Esc` / `P` | Pause |
| `Tab` / `↑` `↓` / `Enter` | Navigate menus without a mouse |
| `F3` | Profiler overlay |
| **Touch** — drag anywhere | Move the paddle |
| **Touch** — tap | Launch the ball |
| **Touch** — pause button, top right | Pause |

Play in landscape; portrait shows a rotate prompt.

## Tuning

Every number that decides how the game feels, and both content registries, live in
[src/config/](src/config/):

| File | Change it to... |
|---|---|
| [feel.ts](src/config/feel.ts) | retune ball speed, the paddle curve, wall proportions, difficulty, drop rates, pacing |
| [blocks.ts](src/config/blocks.ts) | add or rebalance a brick type — one table row |
| [powerups.ts](src/config/powerups.ts) | add or rebalance a power-up — one table row; set `weight: 0` to disable one |

No gameplay code hard-codes these values.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it works and why
- [docs/ROADMAP.md](docs/ROADMAP.md) — build order
