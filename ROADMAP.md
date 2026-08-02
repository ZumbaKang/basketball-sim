# TIPOFF Roadmap

Living backlog for continuous iteration. Open work and the shipped log live in
**separate files** under `roadmap/` so concurrent iterate PRs and the every-~4-days
reprioritize job stop colliding on one giant markdown file.

| File | Who edits it | Conflict posture |
| --- | --- | --- |
| `ROADMAP.md` (this file) | Humans / rare process changes | Almost never |
| `roadmap/now.md` | Iterate (remove done item, append 1–3 follow-ups); Reprioritize (reorder only) | Low — edits are delete-one + append-at-end |
| `roadmap/next.md` | Same as Now | Low |
| `roadmap/later.md` | Same as Now | Low |
| `roadmap/shipped.md` | Iterate — **prepend** one dated bullet | Auto-merged via `merge=union` |

## How this gets worked

1. Pick the **first unchecked item**, top to bottom, in `roadmap/now.md` before
   moving to `roadmap/next.md` or `roadmap/later.md`.
2. Respect `AGENTS.md` / `.cursor/rules/ownership.mdc` — one domain per PR.
   If an item spans domains, split it into per-domain sub-tasks first (edit
   the matching `roadmap/*.md` file) rather than editing multiple domain folders
   in one PR.
3. Implement the item, add/update tests in the owning workspace (and `qa/` for
   cross-cutting checks), run `npm test` for the touched workspace(s).
4. **In that same branch/commit — before opening the PR** — update roadmap files:
   - **Remove** the completed item from `roadmap/now.md` (or Next/Later). Do
     **not** leave a checked `[x]` box in the open lists.
   - **Prepend** one dated line under the header comments in
     `roadmap/shipped.md` (newest first).
   - **Append** 1–3 new unchecked follow-ups at the **end** of Now, Next, or
     Later (never insert in the middle — that causes reorder conflicts).
5. Open exactly **one PR** per roadmap item from one feature branch, containing
   both the code change and the `roadmap/*` updates. Use the PR body to note
   which item this closes.
   **HARD RULE:** A PR whose diff is *only* roadmap files is a bug — **except**
   a `TIPOFF Roadmap Reprioritize` PR (title like `roadmap: reprioritize backlog`),
   whose job is reordering Now/Next/Later. A standalone "mark X shipped" PR is
   still a bug; fold missing bookkeeping into the next feature PR instead.
6. If an item turns out bigger than one PR, break it into smaller checkboxes in
   place (same PR as the first sub-item) rather than shipping a half-finished
   cross-domain change.
7. If blocked, leave the item unchecked, add a `_Blocked: why_` note under it,
   and move on.
8. **Refill the backlog in the same PR** (the appends from step 4). Each new
   item must be concrete and single-PR-sized — owning domain, change, how to
   verify. Max 3 new items per run.
9. **Do not invent CI/automation/repo-process changes on your own.**
   `.github/workflows/cursor-pr-ready.yml` is a deliberately authorized
   exception. Process/CI changes need their own backlog item and explicit review.

## Conflict-avoidance rules (read these)

- Open lists (`now` / `next` / `later`) contain **only** `- [ ]` items. Completed
  work is deleted from those files and recorded in `shipped.md`.
- Feature PRs may **delete** their own item and **append** follow-ups at the
  file end. They must **not** reorder other people's items.
- Only **TIPOFF Roadmap Reprioritize** reorders Now/Next/Later.
- `roadmap/shipped.md` is append/prepend-only. `.gitattributes` sets
  `merge=union` so two PRs that each add a shipped line auto-merge instead of
  conflict.
- Prefer rebasing onto `main` before push if `roadmap/now.md` moved; do not
  hand-resolve by inventing a third ordering.

## Automations

- **TIPOFF Iterate** (every ~3h): picks first open Now item, implements it,
  updates `roadmap/*.md` per steps 4–5, opens one PR.
- **TIPOFF Roadmap Reprioritize** (every ~4 days): reorders unchecked items
  across/within `now.md` / `next.md` / `later.md` only. Does not touch code,
  does not edit `shipped.md`, does not check off items.
