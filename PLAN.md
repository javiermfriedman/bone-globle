# Bone Globle — High-Level Plan

A Globle-style guessing game for studying skeletal anatomy. A mystery bone is chosen at
random; the player types bone names, and each guessed bone lights up on an interactive
3D skeleton with a heat color based on its physical distance to the mystery bone.
Find it, read a short info card, play again.

## Decisions (agreed 2026-09-29)

| Topic              | Decision                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Closeness metric   | Straight-line 3D distance between bone centroids (min over left/right pairs)                                                                                                               |
| Answer pool        | Full detail: every rib, vertebra, carpal/tarsal/metacarpal/phalanx, 22 skull bones, hyoid, patella. No ear ossicles (absent from the source model). Updated 2026-09-29: the hallux sesamoids are one pooled answer, giving 117 distinct answers once left/right are merged. |
| Laterality         | One answer per bone type; both sides light up                                                                                                                                              |
| Input              | Text box with fuzzy autocomplete; anatomical names + common synonyms (kneecap, C1/atlas, rib 2)                                                                                            |
| Feedback           | Heat color on the model only, no numbers or text hints                                                                                                                                     |
| Win state          | Bone info card (name, region, articulations, landmarks, fact) with camera framing the bone, then Play again                                                                                |
| Camera             | Free orbit/zoom/pan. Unguessed bones render translucent (x-ray) so interior guesses show through                                                                                           |
| Audience / hosting | Public site on Vercel. Develop locally first, repo prepped for GitHub                                                                                                                      |
| Stack              | Vite + React + TypeScript, Three.js via react-three-fiber, no backend, stats in localStorage                                                                                               |
| Modes              | Unlimited play (new random bone each game). Daily mode is a possible later addition                                                                                                        |

## 3D model source

Primary: **BodyParts3D** (DBCLS, Univ. of Tokyo). Every bone is a separate OBJ with an
English name and an FMA ontology ID, including individual vertebrae, ribs and phalanges.
License: CC BY 4.0 per the official DBCLS page (verified 2026-09-29); attribution required, app code stays
ours. We convert the OBJs to a single glTF ourselves (trimesh + gltf-transform); the MIT-licensed
`ashemag/human-atlas` project is a reference for the same conversion.

Fallback: **NIH 3D "CT Derived Human Skeleton"** (CC BY 4.0, bones pre-separated,
~570k triangles). Use if BodyParts3D meshes look too rough or licensing is unclear.

## Phases

### Phase 1 — Asset pipeline (offline, one-time)

- Download the BodyParts3D skeletal subset; select bones by FMA name.
- Build the **bone catalog**: a JSON file that is the single source of truth. Each entry
  has a slug, display name, synonyms, region (axial/appendicular, sub-region), the
  mesh node names it maps to (left + right), and the info-card text.
- Blender/script pass: rename meshes to slugs, drop ossicles/sesamoids, decimate,
  export one GLB, compress (target well under 10 MB).
- Precompute a centroid per mesh and a distance table between all answer bones, so the
  game never does geometry math at runtime.
- Write the info-card content (~120 entries). This is the biggest content task; draft
  with an AI pass, then you review for accuracy against your course material.

### Phase 2 — 3D viewer

- Load the GLB, index meshes by name, orbit controls, translucent base material.
- Per-bone coloring API: set a bone to a heat color, reset all.
- Camera fly-to for the win state.
- Performance check on a laptop and a phone.

### Phase 3 — Game loop

- Pick mystery bone (uniform random over the answer pool, avoid repeating last N).
- Autocomplete over names + synonyms, rejects duplicates and unknown input.
- On guess: look up distance, map to color (Globle-style red-hot to cool), color both
  sides, add to guess list.
- On correct: info card, guess count, Play again.
- Guess history panel listing guessed bones in heat order.
- localStorage stats: games played, average guesses, bones that took the most guesses.

### Phase 4 — Polish and ship

- Landing/instructions modal, mobile layout, dark theme like Globle.
- Attribution page for BodyParts3D (required by license).
- README, LICENSE (code MIT, model files CC BY 4.0), .gitignore, GitHub repo.
- Deploy to Vercel from the repo; test the production build.

### Later ideas (not in scope now)

- Daily mode with shared seed and streaks, share-result button.
- Difficulty presets (skull only, hand & foot, basic).
- Recognition mode (click the bone instead of typing).

## Risks

- **Mesh quality**: BodyParts3D bones are CT-derived and somewhat blobby; small bones
  (phalanges, carpals) may be hard to see. Mitigation: x-ray rendering, zoom, fallback model.
- **Distance feel**: centroid distance can be counterintuitive (a rib is "close" to a
  vertebra while being a different region). Accepted, this is the chosen mechanic;
  tune the color scale after playing.
- **Content accuracy**: info cards must be checked by a human before publishing.
- **License**: resolved, CC BY 4.0. Ship the attribution string.
