#!/usr/bin/env bash
# 04_optimize.sh - weld + (optional) simplify + meshopt the raw skeleton GLB.
# Never runs join/flatten/dedup: the 203 per-bone named nodes must survive.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW="$ROOT/data/bp3d/skeleton_raw.glb"
OUT="$ROOT/public/models/skeleton.glb"
TMP="$ROOT/data/bp3d/_opt"
MAX_BYTES=$((6 * 1024 * 1024))

[ -f "$RAW" ] || { echo "missing $RAW - run 03_build_glb.py" >&2; exit 1; }

# Resolve the CLI: local node_modules, then a scratch install, then npx.
GT_SCRATCH="${GT_SCRATCH:-/private/tmp/claude-501/-Users-javierfriedman-chud-bone/c09b2b64-0476-40e2-9a66-6223c69e0eeb/scratchpad/gt}"
if [ -x "$ROOT/node_modules/.bin/gltf-transform" ]; then
  GT="$ROOT/node_modules/.bin/gltf-transform"
elif [ -x "$GT_SCRATCH/node_modules/.bin/gltf-transform" ]; then
  GT="$GT_SCRATCH/node_modules/.bin/gltf-transform"
else
  GT="npx --yes @gltf-transform/cli"
fi
echo "gltf-transform: $GT"

rm -rf "$TMP"; mkdir -p "$TMP"; mkdir -p "$(dirname "$OUT")"

echo "== weld =="
$GT weld "$RAW" "$TMP/welded.glb"

echo "== meshopt =="
$GT meshopt --level medium "$TMP/welded.glb" "$TMP/meshopt.glb"

SIZE=$(stat -f%z "$TMP/meshopt.glb" 2>/dev/null || stat -c%s "$TMP/meshopt.glb")
echo "after meshopt: $SIZE bytes"

if [ "$SIZE" -gt "$MAX_BYTES" ]; then
  echo "== over 6 MB: simplify --ratio 0.5 --error 0.001, then meshopt =="
  $GT simplify "$TMP/welded.glb" "$TMP/simplified.glb" --ratio 0.5 --error 0.001
  $GT meshopt --level medium "$TMP/simplified.glb" "$TMP/meshopt.glb"
  SIZE=$(stat -f%z "$TMP/meshopt.glb" 2>/dev/null || stat -c%s "$TMP/meshopt.glb")
  echo "after simplify+meshopt: $SIZE bytes"
fi

cp "$TMP/meshopt.glb" "$OUT"
rm -rf "$TMP"

echo "== verify =="
RAW_GLB="$RAW" OUT_GLB="$OUT" node -e '
const fs=require("fs");
function read(p){
  const b=fs.readFileSync(p);
  let off=12, doc=null;
  while(off<b.length){
    const len=b.readUInt32LE(off), type=b.readUInt32LE(off+4);
    if(type===0x4E4F534A){doc=JSON.parse(b.slice(off+8,off+8+len).toString("utf8"));break;}
    off+=8+len;
  }
  const names=(doc.nodes||[]).filter(n=>n.mesh!==undefined).map(n=>n.name);
  let tris=0;
  for(const m of doc.meshes||[]) for(const p of m.primitives||[]){
    const acc=doc.accessors[p.indices!==undefined?p.indices:p.attributes.POSITION];
    tris += Math.floor(acc.count/3);
  }
  return {names, tris, bytes:b.length, nodes:(doc.nodes||[]).length};
}
const raw=read(process.env.RAW_GLB), out=read(process.env.OUT_GLB);
const missing=raw.names.filter(n=>!out.names.includes(n));
console.log("raw  mesh nodes:", raw.names.length, " triangles:", raw.tris);
console.log("final mesh nodes:", out.names.length, " triangles:", out.tris);
console.log("final size:", (out.bytes/1048576).toFixed(2), "MB", `(${out.bytes} bytes)`);
if(missing.length){console.error("MISSING NODES:", missing.slice(0,20)); process.exit(1);}
if(out.names.length!==raw.names.length){console.error("node count mismatch"); process.exit(1);}
console.log("node names preserved: OK");
'
echo "wrote $OUT"
