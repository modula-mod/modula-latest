# Greenfield × MPS pin

MPS 1.0-RC is consumed as an external contract. This branch pins the MPS
convergence commit until that PR merges to `modula-product-standard` main.

| Repo | Ref |
| --- | --- |
| `modula-mod/modula-product-standard` | `bf48c3f581787783d1c2aaf6acaba9a46e56250d` (`cursor/mps-v1-rc-convergence-a0be`) |
| Greenfield Backend V1 baseline | `29256c06c6b7f932fb1a9acc6e7e32bfce47e28b` |

Until MPS main absorbs that commit, Greenfield tests use copied JSON fixtures
under `fixtures/mps/` so they do not float on MPS `main`.

| Contract | Version |
| --- | --- |
| MPS | 1.0-RC |
| Module Standard | 2.1 |
| Greenfield Protocol | greenfield.v1 |
