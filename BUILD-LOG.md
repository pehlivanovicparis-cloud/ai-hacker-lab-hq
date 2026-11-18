# AI Hacker Lab HQ — Build Log (standalone, v1.0.0)

Built 2026-11-18 from the hosted artifact `ai-hacker-lab-hq` (probed live via
getState/getExport + action schemas; source never read, artifact untouched).
Stack: Node.js stdlib only, zero dependencies. `node server.js`, port 3000
(`PORT` override). Data in `data/data.json`, created from `data/seed.json`
on first run; `data/data.json` is gitignored.

## What shipped (9 files, repo pehlivanovicparis-cloud/ai-hacker-lab-hq, main)
- package.json, server.js, public/index.html, public/app.js, public/styles.css
- data/seed.json (Lab 1 pre-seeded solved, confirmed 2026-11-18 writeup)
- README.md, LICENSE (© 2026 Paris Pehlivanovic, all rights reserved), .gitignore
- Head commit: 60b3b12bb4d1ac82e6e4b595654981a224760c9c (LICENSE)
  9 commits total on top of GitHub's Initial commit (one per file — see below).

## Push note (important)
`github push-files` FAILED twice with the same error (both approved):
`failed to create branch from default: failed to resolve default branch:
failed to get repository info: GET .../repos/pehlivanovicparis-cloud/ai-hacker-lab-hq: 404`.
Reads (search/list_commits/get_file_contents) see the repo fine, and
`create_or_update_file` works fine — the 404 is specific to push_files'
branch-resolution path for this repo. Fell back to `create_or_update_file`,
one commit per file (9 approvals, all granted). Sync record written adjacent
to the source dir per the snapshot-push guide (one entry per commit/path).
If push_files is ever fixed for this repo, future pushes can go back to it.

## Smoke test (all observed, 2026-11-18 ~21:22–21:23 UTC)
- `node --check` server.js + app.js OK; seed.json/package.json parse OK.
- GET /api/state: labs [["lab-1","solved"]], curriculum 7 labs / 10 Lakera / 7 plan.
- GET / 200, /app.js 200, /styles.css 200. GET /api/export valid JSON with exportedAt.
- GET /api/export/markdown returns "# AI Hacker Lab HQ — Portfolio".
- POST /api/labs lab-2 in_progress + POST /api/journal "smoke entry" id 1: both OK.
- Restart: lab-2 + journal entry persisted (read back after restart).
- Bogus restore (lab-99) → 400 "backup rejected: labs[0]: invalid row"; bogus lab save → 400 "unknown labId: lab-99".
- Valid import without confirm → {needsConfirmation:true, summary:{labs:2,lakera:0,planChecks:0,journal:1,findings:0}}.
- After tests: data/data.json reset; clean-seed check showed only lab-1 solved, 0 journal/findings/lakera/planChecks. Test server stopped.

## Deliberate simplifications vs the hosted artifact
- Journal/finding edits use prompt() dialogs instead of inline editors (same capability, simpler code).
- Restore is a server-side two-step (validate → confirm → apply) rather than a two-tap ConfirmButton.
- No separate seedlab1progress action — Lab 1 is seeded directly in seed.json.
- Curriculum metadata (lab titles/lessons, Lakera names, plan blocks) lives in server.js constants.
- Single-page dark-theme UI; no auth (localhost tool, same as the hosted artifact's local nature).
- Lab 2 described only as "vulnerabilities in LLM APIs — a normal tool whose backend passes input through unsanitized". No payload strings, shell separators, rm commands, file paths, or injection wording for Lab 2 (or Labs 3–7) anywhere in the repo.

## Self-score
1) Goal hit? Yes — standalone Lab HQ built, smoke-tested (incl. restart persistence + bogus-restore rejection), all 9 files in the repo and verified by read-back.
2) Tools right? Mostly — the artifact probe gave the exact data model; push_files was the wrong tool here (repo-info 404) and create_or_update_file was the working one.
3) Waste — what I'd skip next time? The second doomed push_files retry (one identical 404 was enough to diagnose); and the background-server kill dance — kill by PID from the start instead of `kill %1` on a backgrounded cd-list.
