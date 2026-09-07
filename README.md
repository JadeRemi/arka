# ARKA

A canvas arkanoid. Procedurally generated levels, continuous-collision ball physics,
parallax backgrounds and dithered gradients. Everything on screen — including the fonts and
the buttons — is drawn by the game into a single `<canvas>`.

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
| `←` `→` | Move the paddle |
| `Space` / click | Launch the ball |
| `Esc` / `P` | Pause |
| `Enter` | Confirm in menus |
| `F3` | Profiler overlay |

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it works and why
- [docs/ROADMAP.md](docs/ROADMAP.md) — build order
