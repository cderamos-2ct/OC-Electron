# Legacy Area

This directory holds imported or historical project material that is **not**
part of the canonical OpenClaw source tree.

Rules:

- `legacy/imported/` contains archived external or legacy project trees moved out
  of `docs/` during repo cleanup.
- `legacy/links/` contains legacy symlinks or external references that should
  not be treated as canonical repo content.
- Contents under these directories are intentionally ignored by Git unless
  explicitly promoted later.

If something in `legacy/` becomes truly canonical, move it back into the
appropriate source tree (`docs/`, `dashboard/`, `scripts/`, etc.) rather than
editing it in place here.
