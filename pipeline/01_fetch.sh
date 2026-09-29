#!/usr/bin/env bash
# 01_fetch.sh - download BodyParts3D 4.0 source data into data/bp3d/
# Idempotent: skips files that already exist, resumes partial downloads.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/data/bp3d"
BASE="https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST"

FILES=(
  "isa_BP3D_4.0_obj_99.zip"
  "isa_element_parts.txt"
  "isa_parts_list_e.txt"
  "partof_inclusion_relation_list.txt"
)

mkdir -p "$DEST"

for f in "${FILES[@]}"; do
  out="$DEST/$f"
  if [ -s "$out" ]; then
    echo "skip (present): $f  ($(du -h "$out" | cut -f1))"
    continue
  fi
  echo "fetching: $f"
  if ! curl -fL -C - --retry 3 --retry-delay 2 -o "$out" "$BASE/$f"; then
    echo "ERROR: $BASE/$f failed. Directory listing follows:" >&2
    curl -fsSL "$BASE/" | sed -e 's/<[^>]*>/ /g' | tr -s ' \n' ' \n' | grep -iE 'isa|partof|\.zip|\.txt' || true
    rm -f "$out"
    exit 1
  fi
  echo "ok: $f  ($(du -h "$out" | cut -f1))"
done

echo "--- data/bp3d contents ---"
ls -lh "$DEST"
