# Bone Globle

A Globle-style guessing game for studying skeletal anatomy. A mystery bone is chosen at
random; type bone names and each guess lights up on an interactive 3D skeleton with a
heat colour based on its distance to the mystery bone.

## Run locally

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` – Vite dev server
- `npm run build` – type-check and production build
- `npm test` – vitest unit tests
- `npm run lint` / `npm run format`

## Asset pipeline

The skeleton model is built once from BodyParts3D by the scripts in `pipeline/`
(see `CODING_PLAN.md`). The raw download lives in `data/bp3d/` and is not committed.

## Licensing

Code: MIT (`LICENSE`). Skeleton model: CC BY 4.0, see `ATTRIBUTION.md`.
