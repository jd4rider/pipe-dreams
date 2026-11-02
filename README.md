# Pipe Dreams

Rotate pipes to guide the water through increasingly tricky levels. Built with Phaser 4, Vite and Electron — playable in the browser and as a desktop app for macOS, Windows and Linux.

- Play in your browser: <https://jd4rider.github.io/pipe-dreams/play/>
- Downloads: <https://github.com/jd4rider/pipe-dreams/releases/latest>

## How to play

Tap a pipe to turn it a quarter-turn. Connect **IN** to **OUT** so the water can flow through. Pipes with a bolt are fixed in place, and brick walls are in the way.

- **Puzzle** — 60 levels across 5 worlds. Grids grow from 4×4 to 9×9 and add tees, crosses, walls and fixed pipes. Finish close to par for 3 stars.
- **Rush** — 90 seconds. Every solved puzzle adds time and the next one is bigger.

Use **Hint** to highlight a pipe that needs turning and **Reset** to start the level over.

## Develop

```sh
npm install
npm run dev      # web dev server
npm test         # puzzle logic tests
npm start        # build and open in Electron
npm run dist:mac # package an installer (also dist:win, dist:linux)
```

## Release

Push a tag like `v0.1.0` and the **Release apps** workflow builds the macOS, Windows and Linux installers. Every push to `main` deploys the web version to GitHub Pages.
