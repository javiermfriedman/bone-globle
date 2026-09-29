I am building "Bone Globle", a Globle-style bone-guessing game for studying anatomy, in /Users/javierfriedman/chud_bone. Planning is finished. Read these three files first and treat them as the spec; do not re-plan or re-ask decisions that are settled there:

- PLAN.md (product decisions)
- CODING_PLAN.md (repo layout, data contracts, pipeline steps, milestones M0-M6 with acceptance checks, subagent delegation)
- data/bone_catalog_draft.csv (120 answer bones, draft mesh-name mappings)

Implement milestones M0 through M4 now, then stop and show me the running game before M5/M6. Work autonomously; only stop for questions where the spec is genuinely silent.

Time efficiency matters. Use Opus subagents (Agent tool, model opus, run in background) for independent work and run them in parallel, while you do the main-session work yourself. Concretely:

1. Immediately launch, in parallel:
   - Subagent A (asset pipeline, M1): write and run pipeline/01_fetch.sh through 04_optimize.sh exactly as CODING_PLAN.md describes. Download the BodyParts3D 4.0 zip and tables into data/bp3d (gitignored), select the 203 bone OBJs via the FMA5018 concept, build one GLB with trimesh in a Python venv (node name = English name from the OBJ header, mm to m, Z-up to Y-up, centered at origin), optimize with npx @gltf-transform/cli using meshopt with joining disabled. Output public/models/skeleton.glb and a text file pipeline/node_names.txt listing all node names. Report node count, file size, and any bones that look merged or missing (sternum parts, hip bone, hyoid).
   - Subagent B (catalog, M2 part 1): convert data/bone_catalog_draft.csv into data/bone_catalog.json matching the schema in CODING_PLAN.md, with an empty info object per entry. Add an ignore list file data/ignored_meshes.json for ossicles, sesamoids and any non-answer bone meshes.
     Meanwhile, you do M0 yourself: Vite + React + TypeScript scaffold, react-three-fiber, drei, vitest, eslint/prettier, .gitignore (node_modules, dist, data/bp3d, pipeline/.venv), MIT LICENSE, ATTRIBUTION.md with the exact string "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International" and a link to https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html, README stub, git init and first commit.

2. When A and B finish, launch Subagent C: reconcile bone_catalog.json meshNames against pipeline/node_names.txt so every catalog meshName exists in the GLB and every GLB bone node is either mapped or in ignored_meshes.json. Then write and run pipeline/05_derive.ts to produce public/data/geometry.json (per-answer centroids, bounds, min-centroid pairwise distance matrix, maxDistance). Add the catalog integrity vitest test. Report anything ambiguous.
   Meanwhile, you build M3 (Scene, Skeleton loader with translucent base material and per-mesh coloring, OrbitControls, debug panel to color a slug by name) against the GLB from A.

3. Then build M4 yourself: game reducer, search index with synonyms and fuzzy matching, heat color ramp, GuessInput autocomplete, GuessList, win detection, play again, recent-repeat avoidance, localStorage stats. Unit tests for search, distance, and state.

Verify each milestone's acceptance check from CODING_PLAN.md before moving on. Commit after each milestone with a clear message. When M4 passes, start the dev server, open it in the browser, play one full game yourself to confirm coloring on both sides of paired bones, and then give me a short summary: what works, what is faceted or ugly in the model, anything you had to decide, and the exact command to run it.
