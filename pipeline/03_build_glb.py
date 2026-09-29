#!/usr/bin/env python3
# Run with the pipeline venv: pipeline/.venv/bin/python pipeline/03_build_glb.py
"""
03_build_glb.py - merge the 203 BodyParts3D bone OBJs into one GLB.

- node name = the OBJ header's `# English name : ...` string (exact)
- mm -> m (x0.001)
- Z-up -> Y-up: (x, y, z) -> (x, z, -y)
- whole skeleton recentred on its bounding-box centre
Outputs data/bp3d/skeleton_raw.glb and pipeline/node_names.txt
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parent.parent
BONES = ROOT / "data" / "bp3d" / "bones"
OUT_GLB = ROOT / "data" / "bp3d" / "skeleton_raw.glb"
OUT_NAMES = ROOT / "pipeline" / "node_names.txt"

MM_TO_M = 0.001


def english_name(path: Path) -> str:
    with path.open("r", errors="replace") as fh:
        for line in fh:
            if not line.startswith("#"):
                break
            if line.startswith("# English name"):
                return line.split(":", 1)[1].strip()
    raise ValueError(f"no English name header in {path}")


def main() -> int:
    objs = sorted(BONES.glob("*.obj"))
    if not objs:
        print(f"no OBJs in {BONES} - run 02_select_bones.sh", file=sys.stderr)
        return 1

    # 1. load + transform
    entries = []  # (node_name, fj_id, mesh)
    names_seen = {}
    for p in objs:
        fj = p.stem
        name = english_name(p)
        mesh = trimesh.load(p, process=False, force="mesh")
        v = np.asarray(mesh.vertices, dtype=np.float64) * MM_TO_M
        # Z-up -> Y-up
        v = np.column_stack((v[:, 0], v[:, 2], -v[:, 1]))
        mesh.vertices = v
        names_seen.setdefault(name, []).append(fj)
        entries.append([name, fj, mesh])

    # 2. disambiguate duplicate English names (BodyParts3D has a few)
    dupes = {n: ids for n, ids in names_seen.items() if len(ids) > 1}
    for e in entries:
        if e[0] in dupes:
            e[0] = f"{e[0]} ({e[1]})"
    if dupes:
        print("duplicate English names, suffixed with their FJ id:")
        for n, ids in sorted(dupes.items()):
            print(f"  {n}: {', '.join(ids)}")

    # 3. centre the whole skeleton on its bbox centre
    lo = np.min([m.vertices.min(axis=0) for _, _, m in entries], axis=0)
    hi = np.max([m.vertices.max(axis=0) for _, _, m in entries], axis=0)
    centre = (lo + hi) / 2.0
    print(f"skeleton bbox (m): {lo.round(4).tolist()} .. {hi.round(4).tolist()}")
    print(f"translating by {(-centre).round(4).tolist()}")
    for _, _, m in entries:
        m.vertices = np.asarray(m.vertices) - centre

    # 4. build scene
    scene = trimesh.Scene()
    for name, _fj, mesh in entries:
        mesh.metadata["name"] = name
        scene.add_geometry(mesh, node_name=name, geom_name=name)

    OUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    OUT_GLB.write_bytes(trimesh.exchange.gltf.export_glb(scene, include_normals=True))

    names = sorted(n for n, _, _ in entries)
    OUT_NAMES.write_text("\n".join(names) + "\n")

    tris = sum(len(m.faces) for _, _, m in entries)
    size = OUT_GLB.stat().st_size
    print(f"meshes: {len(entries)}  triangles: {tris}")
    print(f"wrote {OUT_GLB} ({size/1e6:.2f} MB)")
    print(f"wrote {OUT_NAMES} ({len(names)} names)")

    # 5. verify node names survived into the GLB JSON chunk
    verify(OUT_GLB, set(names))
    return 0


def verify(glb_path: Path, expected: set) -> None:
    data = glb_path.read_bytes()
    assert data[:4] == b"glTF", "not a GLB"
    off = 12
    doc = None
    while off < len(data):
        clen, ctype = struct.unpack_from("<II", data, off)
        chunk = data[off + 8 : off + 8 + clen]
        if ctype == 0x4E4F534A:
            doc = json.loads(chunk.decode("utf-8"))
            break
        off += 8 + clen
    assert doc is not None, "no JSON chunk"
    node_names = {n.get("name") for n in doc.get("nodes", []) if "mesh" in n}
    missing = expected - node_names
    extra = node_names - expected
    print(f"GLB nodes: {len(doc.get('nodes', []))} total, {len(node_names)} mesh nodes")
    if missing:
        print(f"MISSING node names ({len(missing)}): {sorted(missing)[:10]}", file=sys.stderr)
        raise SystemExit(1)
    if extra:
        print(f"unexpected extra node names: {sorted(extra)[:10]}", file=sys.stderr)
    print("node-name verification: OK")


if __name__ == "__main__":
    raise SystemExit(main())
