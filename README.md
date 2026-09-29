# Bone Globle

A [Globle](https://globle-game.com)-style guessing game for learning the bones of the
human skeleton. A mystery bone is chosen at random. Type bone names; each guess lights
up on an interactive 3D skeleton with a heat colour based on its straight-line distance
to the mystery bone. Find it, read a short info card, play again.

- 117 answer bones: every rib, vertebra, carpal, tarsal, metacarpal, metatarsal and
  phalanx, the 22 skull bones, hyoid, patella and the hallux sesamoids. Paired bones count once and both
  sides light up.
- Press Enter to check a name. Exact display names and common synonyms (kneecap,
  collarbone, C1, rib 2) guess straight away; a near-miss spelling brings up a short list
  of similar names to pick from. No suggestions appear while you type, so the game tests
  recall rather than typing.
- Unguessed bones render translucent so guesses inside the skull or chest show through.
- A 🦴 button lists every bone in the game, grouped by region.

## Run locally

```bash
npm install
npm run dev
```

Add `?debug` to the URL to see the current answer and a panel that colours any bone by
slug.

## Scripts

| Command           | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Vite dev server                                  |
| `npm run build`   | Type-check and production build into `dist/`     |
| `npm run preview` | Serve the production build                       |
| `npm test`        | Vitest unit and data-integrity tests             |
| `npm run lint`    | ESLint                                           |
| `npm run format`  | Prettier                                         |
| `npm run derive`  | Rebuild `public/data/geometry.json` from the GLB |

## Project layout

```
data/bone_catalog.json     source of truth: slugs, names, synonyms, mesh names, info cards
data/ignored_meshes.json   GLB bone nodes that are not answers (foot sesamoids)
pipeline/                  one-time asset build from BodyParts3D (see below)
public/models/skeleton.glb 206 named bone meshes, meshopt-compressed (3.7 MB)
public/data/geometry.json  per-bone centroids, bounds and the pairwise distance matrix
src/data                   catalog loader, search index
src/game                   reducer, distance/heat colour, random answer
src/three                  Scene, Skeleton loader, camera fly-to
src/ui                     input, guess list, win card, help and bone-list modals
tests/                     vitest
```

## Asset pipeline

The skeleton is built once from [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/)
4.0. The raw download (about 140 MB) lives in `data/bp3d/` and is not committed.

```bash
./pipeline/01_fetch.sh                                # download zip and tables
./pipeline/02_select_bones.sh                         # FMA5018 bones + sternum parts -> OBJs
python3 -m venv pipeline/.venv && pipeline/.venv/bin/pip install -r pipeline/requirements.txt
pipeline/.venv/bin/python pipeline/03_build_glb.py    # OBJ -> one GLB, metres, Y-up, centred
./pipeline/04_optimize.sh                             # meshopt compress -> public/models/skeleton.glb
npm run derive                                        # -> public/data/geometry.json
```

Notes on the source data: BodyParts3D has no coccyx or auditory ossicle meshes (those catalog entries are kept but
never used as answers), the hip bone is one mesh per side (ilium, ischium and pubis are synonyms), and the sternum comes as
manubrium, body and xiphoid process, which the catalog maps to a single answer.

## Deploy

The app is a static site. `vercel.json` rewrites every path to `index.html`. On Vercel,
import the GitHub repo with the Vite preset (build `npm run build`, output `dist`).

## Licensing

Code: MIT (`LICENSE`). Skeleton model: CC BY 4.0, see `ATTRIBUTION.md`. Info-card text
was drafted with AI assistance against standard anatomy references and should be
checked against your course material before relying on it.
