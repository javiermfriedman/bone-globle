#!/usr/bin/env bash
# 02_select_bones.sh - pick the FMA5018 ("bone organ") elements and extract only those OBJs.
# Idempotent: re-extracts into a clean data/bp3d/bones/ each run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BP3D="$ROOT/data/bp3d"
TABLE="$BP3D/isa_element_parts.txt"
ZIP="$BP3D/isa_BP3D_4.0_obj_99.zip"
OUT="$BP3D/bones"
IDS="$BP3D/bone_ids.txt"

[ -f "$TABLE" ] || { echo "missing $TABLE - run 01_fetch.sh" >&2; exit 1; }
[ -f "$ZIP" ]   || { echo "missing $ZIP - run 01_fetch.sh" >&2; exit 1; }

# Table is TSV with header: concept id <TAB> name <TAB> element file id
awk -F'\t' 'NR>1 && $1=="FMA5018" {print $3}' "$TABLE" | sort -u > "$IDS"

# BodyParts3D files the three sternum segments under their own FMA concepts
# (FMA7486 manubrium, FMA7487 body of sternum, FMA7488 xiphoid process), so they
# are NOT in FMA5018 (they live under FMA7486/7487/7488). They are included by default
# so the catalog's `sternum` entry can map to all three; set EXTRA_FJ_IDS="" to skip.
EXTRA_FJ_IDS="${EXTRA_FJ_IDS-FJ3290 FJ3178 FJ3153}"
# The rest of the pipeline is count-agnostic; only this baseline is 203.
if [ -n "${EXTRA_FJ_IDS:-}" ]; then
  for id in $EXTRA_FJ_IDS; do echo "$id"; done >> "$IDS"
  sort -u -o "$IDS" "$IDS"
  echo "including EXTRA_FJ_IDS: $EXTRA_FJ_IDS"
fi

N=$(wc -l < "$IDS" | tr -d ' ')
echo "selected element ids: $N"
if [ "$N" -ne 203 ] && [ -z "${EXTRA_FJ_IDS:-}" ]; then
  echo "WARNING: expected 203 bone ids, got $N" >&2
  echo "  header: $(head -1 "$TABLE")" >&2
fi

rm -rf "$OUT"
mkdir -p "$OUT"

# unzip -j flattens; feed the exact archive paths.
# shellcheck disable=SC2046
unzip -q -j "$ZIP" $(awk '{printf "isa_BP3D_4.0_obj_99/%s.obj ", $1}' "$IDS") -d "$OUT"

EXTRACTED=$(ls -1 "$OUT"/*.obj 2>/dev/null | wc -l | tr -d ' ')
echo "extracted OBJs: $EXTRACTED -> $OUT"
[ "$EXTRACTED" -eq "$N" ] || { echo "ERROR: extracted $EXTRACTED of $N" >&2; exit 1; }
