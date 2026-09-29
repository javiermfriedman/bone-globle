# Attribution

## 3D skeleton model

The skeleton model shipped in `public/models/skeleton.glb` is derived from BodyParts3D.

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International

- License page: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- License text: https://creativecommons.org/licenses/by/4.0/
- Source data: BodyParts3D 4.0, `isa_BP3D_4.0_obj_99` (polygon-reduced OBJ set)

Modifications made by this project: the 203 bone meshes were selected from the full
dataset, converted from OBJ to a single glTF binary, rescaled from millimetres to
metres, re-oriented to Y-up, centred at the origin, and compressed with meshoptimizer.
No anatomical geometry was added.

## Application code

The application source code is © 2026 Javier Friedman and released under the MIT
License (see `LICENSE`). The MIT license does not extend to the model files, which
remain under CC BY 4.0 as stated above.
