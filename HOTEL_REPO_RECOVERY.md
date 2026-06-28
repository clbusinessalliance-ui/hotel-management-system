# HOTEL PMS — LOCAL ↔ GITHUB REPO RECOVERY REPORT

**Audit type:** Read-only comparison. No files overwritten/deleted, no packages installed, no migrations run. Only `git fetch` (updates remote-tracking refs only — does not touch your working files) was used, plus this report file.
**Audit date:** 2026-06-28
**Local folder:** `C:\Users\Tep chanchampa\OneDrive\Documents\Hotel sotware`
**Remote:** `https://github.com/clbusinessalliance-ui/hotel-management-system.git`

---

## TL;DR — which copy is newer & safer

> **Your LOCAL folder is the newest and most complete copy — and it is already safely backed up on GitHub on the branch `claude/clever-cori-5g3mv3` (they are identical at the commit level).**
>
> 🔴 **The GitHub `main` branch is STALE and effectively EMPTY of source code** (34 files, **0 files under `src/`**, last touched 2026-04-01). It is *not* a newer version and *must not* be used to "restore" or overwrite your local work — doing so would destroy the entire application.
>
> ✅ **Safest action: keep working in the local folder.** Optionally commit/push the 3 small pending items, then (on GitHub) promote `claude/clever-cori-5g3mv3` to be the new `main`. Nothing needs to be pulled down to rescue your code.

---

## Answers to your 8 questions

### 1. Does the local folder exist?
✅ **Yes.** `C:\Users\Tep chanchampa\OneDrive\Documents\Hotel sotware` exists and is a git repository.

### 2. Is it connected to this GitHub remote?
✅ **Yes — exact match.**
```
origin  https://github.com/clbusinessalliance-ui/hotel-management-system.git (fetch)
origin  https://github.com/clbusinessalliance-ui/hotel-management-system.git (push)
```

### 3. What is the local git status?
- **Branch:** `claude/clever-cori-5g3mv3` — *"Your branch is up to date with `origin/claude/clever-cori-5g3mv3`."*
- **Modified (unstaged):** `package-lock.json`
- **Untracked:** `HOTEL_PROJECT_RECOVERY.md` (the recovery report created in the previous session) and `cc9d316polishappdocs.patch` (a leftover patch artifact)
- Working tree is otherwise clean.

### 4. What is the latest LOCAL commit?
`92bbd0a` — *"docs: refresh README to match real architecture + add Windows run guide"* — Claude — **2026-06-24 15:44 UTC**
(parent: `3e7aee8` *"Add local Hotel software build"*, 2026-06-24)

### 5. What is the latest GitHub commit?
Depends on the branch — this is the crux of the situation:

| GitHub branch | Latest commit | Date | Meaning |
|---|---|---|---|
| `origin/claude/clever-cori-5g3mv3` | **`92bbd0a`** | **2026-06-24** | **Identical to your local branch — the real, complete app** |
| `origin/main` (the repo's default) | `19ae0c9` (Merge PR #3) | **2026-04-01** | **Stale Phase-1 shell — no `src/` application code** |
| `origin/codex/fix-electron-asset-loading…` | `bc17f6e` | (Apr) | old feature branch |
| `origin/codex/fix-local-setup…` | `ba23e5b` | (Apr) | old feature branch |
| `origin/codex/build-phase-1…` | `b4e7c06` | (Apr) | old feature branch |

So: your local commit **already exists on GitHub** (on the `claude/...` branch). The GitHub **default branch (`main`) is two-and-a-half months older and lacks the app**.

### 6. Are there uncommitted local changes?
✅ **Yes, but only minor/non-code:**
- `package-lock.json` modified (dependency lockfile drift).
- 2 untracked docs/artifacts (`HOTEL_PROJECT_RECOVERY.md`, `cc9d316polishappdocs.patch`).

No application source files are uncommitted. Your committed code matches GitHub exactly:
```
git diff --stat HEAD origin/claude/clever-cori-5g3mv3   →  (empty)  ✅ identical
```

### 7. Which copy has more complete code?
**The local copy / `claude/clever-cori-5g3mv3` branch — by a wide margin.** The two histories are **completely unrelated** (no common ancestor — see below), so this is not "ahead/behind," it's two different lines:

| Measure | Local `HEAD` (= `origin/claude/...`) | `origin/main` |
|---|---|---|
| Total tracked files | **85** | 34 |
| Files under `src/` | **75** | **0** |
| `src/renderer/` (React UI) | **all 10 panels + forms + tests** | none |
| `src/shared/ipc/contract.ts` | present | none |
| `src/main/*` (Electron wiring) | present | none |
| Build configs (`vite/vitest/tsconfig.main`) | present | partial/none |
| Diff `origin/main → HEAD` | **116 files changed, +12,635 / −632** | — |
| Last meaningful change | 2026-06-24 | 2026-04-01 |

`origin/main` is the old "Phase 1 foundation" merge whose actual source does not live under `src/` in that branch — relative to the working application it is essentially empty.

### 8. Safest recovery action
See the next section. In short: **do nothing destructive; the good copy is local AND already on GitHub. Just promote the good branch to `main`.**

---

## Why the histories diverge (important context)

```
git merge-base HEAD origin/main      →  (empty)        ← NO shared ancestor
git merge-base --is-ancestor …        →  NO            ← main is NOT contained in local
git rev-list --left-right --count origin/main...HEAD  →  7  2
```

- `origin/main` has **7** commits your branch doesn't have (the April Phase-1 lineage: `330c40f` → PRs #1–#3 → `19ae0c9`).
- Your branch has **2** commits `origin/main` doesn't have (`3e7aee8` "Add local Hotel software build" → `92bbd0a` docs).
- They share **no common root** — `3e7aee8` was imported as a fresh/orphan history (a "local build" snapshot), not branched off `main`.

**Consequence:** a naive `git merge origin/main` or `git pull` would try to combine two unrelated trees (Git would refuse without `--allow-unrelated-histories`, and would conflict heavily). And a `git reset --hard origin/main` would **delete your entire application**. Avoid both.

---

## Recommended safest recovery plan (review before any write action)

**Phase A — preserve the current good state (local, low-risk):**
1. Keep working in the local folder; it is the authoritative copy.
2. (Optional) Commit the pending items so the tree is clean and fully mirrored on GitHub:
   - Decide on `package-lock.json` (commit it if deps are intentional, or `git checkout -- package-lock.json` to discard the drift).
   - Add `HOTEL_PROJECT_RECOVERY.md` (and this `HOTEL_REPO_RECOVERY.md`) if you want them tracked.
   - Delete or ignore the stray `cc9d316polishappdocs.patch` (it's already-applied; no un-captured work).
   - `git push` — your branch is already in sync, so this only pushes the new small commits.
3. **Redundant safety:** because the folder lives under **OneDrive**, you already have a cloud mirror; GitHub `claude/...` is a second copy. Your code is in no immediate danger.

**Phase B — make GitHub coherent (on GitHub; recommended, your call):**
4. Promote the complete branch to be the project's mainline. Cleanest options:
   - On GitHub, **change the default branch** to `claude/clever-cori-5g3mv3`, **or**
   - Open a PR/merge `claude/clever-cori-5g3mv3` → `main` using **`--allow-unrelated-histories`** (since there's no shared base) and resolve in favor of the complete branch, **or**
   - Force-update `main` to the complete commit (`git push origin claude/clever-cori-5g3mv3:main --force`) — only if you're certain `origin/main` holds nothing worth keeping (it holds the old Phase-1 history; the *code* is superseded).
5. After `main` reflects the real app, the old `codex/*` branches can be archived/deleted at leisure.

**Do NOT:**
- ❌ `git reset --hard origin/main` (wipes the application)
- ❌ `git pull` / `git merge origin/main` into the working branch (unrelated histories → conflict/corruption risk)
- ❌ delete the local folder trusting GitHub `main` as a backup (main lacks the source)

> I have **not** performed any Phase A/B write action — these are recommendations only, per the read-only constraint.

---

## Summary scorecard

| Question | Finding |
|---|---|
| Local folder exists | ✅ Yes |
| Connected to the GitHub remote | ✅ Yes (exact URL) |
| Local branch | `claude/clever-cori-5g3mv3` @ `92bbd0a` (2026-06-24) |
| Local fully pushed | ✅ Identical to `origin/claude/clever-cori-5g3mv3` |
| GitHub `main` | `19ae0c9` (2026-04-01) — **stale, 0 `src/` files** |
| Uncommitted local changes | Minor only (lockfile + 2 untracked docs) |
| **Newer copy** | **Local = `origin/claude/...` (June 24) ≫ `main` (April 1)** |
| **More complete copy** | **Local (75 src files) ≫ `main` (0 src files)** |
| **Safest copy to continue** | **The local folder (already mirrored on the GitHub `claude/...` branch)** |
| Main risk | Accidentally treating GitHub `main` as authoritative and overwriting local |

*End of report. No project files were modified; `HOTEL_REPO_RECOVERY.md` is the only file created. `git fetch` updated remote-tracking refs only.*
