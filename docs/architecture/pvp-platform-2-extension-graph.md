# PVP Platform Phase 2 extension graph

## Model

The graph is directed. A release declaration creates a requested edge from a
consumer to its target or required dependency. An account installation creates
the resolved edge:

`consumer installation → target installation`

This permits Module → Add-on and Add-on → Plugin without special cases. The
release graph is global and immutable; resolved installation edges are
account-scoped and lifecycle-aware.

## Resolution

`GreenfieldModuleDependencyResolver` combines Standard dependency requests and
2.1 targets, de-duplicates them, and visits published release edges in sorted
order. It returns:

- the selected immutable version and installation state;
- compatibility and blocking status;
- a stable cycle path;
- visited node/depth counts;
- errors and non-blocking warnings.

The effective graph limits are at most 16 levels and 256 nodes for a product
declaration (with hard internal ceilings of 32/1024). A repeated active vertex
returns `DEPENDENCY_CYCLE` and the complete path. Installation does not persist
any edge when resolution fails.

## Install and enable

1. Resolve target and dependencies.
2. Check semver, host/Standard/platform compatibility, release state, and
   checksums.
3. Review capabilities and required extension points.
4. Persist the installation, resolved graph, grants, and registrations in one
   transaction.
5. Let the existing worker project `INSTALLED`, then explicitly enable.

An extension target must already be installed. Optional extensions are never
required for a module to open.

## Update impact

Before a target update, active dependent ranges are checked. An incompatible
dependent is projected `INCOMPATIBLE`/disabled rather than crashing the target.
New release capabilities remain ungranted until a new review records approval.

## Disable and uninstall

`activeDependants` walks resolved account edges deterministically with limits of
8 levels and 128 products. A request that would orphan an enabled extension is
rejected and returns the dependent set. The caller must either cancel or make
an explicit recursive/cascade choice. Retention is independently selected as
`KEEP_DATA` or `DELETE_DATA`.

Edges are never used to cascade deletion across product-owned data. They only
govern installation lifecycle.

## Acceptance failures

- `A → B → C → A`: rejected with `DEPENDENCY_CYCLE`.
- Missing target or version mismatch: incompatible, no registration.
- Missing required extension point: incompatible, no registration.
- Target removal without explicit dependent handling: conflict, no orphan.
- Graph bound exceeded: rejected with `DEPENDENCY_GRAPH_BOUNDS_EXCEEDED`.
