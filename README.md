# AI Hacker Lab HQ

A curriculum tracker for the AI Hacker learning track: the 7 PortSwigger Web
LLM Attacks labs, the 10 Lakera Gandalf Agent Breaker apps, and the 30-day
red-team plan. Each lab, app, and plan item has status tracking, writeup
notes, and a prompt journal; report findings are editable in place.

**Authorized labs only.** PortSwigger Academy and Lakera Gandalf are
intentionally vulnerable training apps. Never run these techniques against
production or real systems without written authorization.

## What's here

- **PortSwigger labs (7):** Excessive Agency, Exploiting Vulnerabilities in
  LLM APIs, Indirect Prompt Injection, Insecure Output Handling, AI Agents
  Triggering Secondary Vulnerabilities, Destructive Actions and CSRF,
  Bypassing Scanner Defenses. Each lab carries a defensive lesson — lessons
  and descriptions only, no exploit payloads.
- **Lakera Gandalf apps (10):** Thingularity, MindfulChat, System Prompt
  Exfiltration, Phishing / Malicious Link Insertion, Unauthorized Tool Call,
  Malicious Code / Command, Data Exfiltration, DoS / Resource Abuse,
  Multi-Step Agent, Expert / Combined. Score 0–100 per app; **75+ passes**.
- **30-day plan (7 blocks):** Days 1–3 Labs 1–2 + writeups; 4–7 Labs 3–4;
  8–11 Labs 5–7; 12–18 Lakera 1 app/day, aim 75+, prompt journal; 19–23
  Arcanum classify 20 prompts on 4 axes; 24–27 first full red-team report
  on a lab app; 28–30 review defenses, re-test, update portfolio.
- **Lab 1 is pre-seeded solved** from the confirmed solve on 2026-11-18:
  the lab chatbot exposed four tools, recon confirmed the user `carlos`
  via a SELECT probe, and DELETE via `debug_sql` removed him. Root cause:
  an LLM-accessible API treated as trusted. Fix: remove the debug tool,
  backend auth, human approval for deletes.

## Run it

Node.js (no dependencies, no install step):

```sh
node server.js
```

Then open http://localhost:3000. Set `PORT` to change the port:

```sh
PORT=8080 node server.js
```

## Data

Progress is stored in `data/data.json`, created from `data/seed.json` on
first run. `data/data.json` is gitignored (it is your working copy);
`data/seed.json` is committed and ships the Lab 1 solved row.

## Backup & restore

- **Download JSON backup** — the complete tracker state plus an export
  timestamp.
- **Download Markdown portfolio** — a readable portfolio of progress,
  writeups, scores, journal, and findings.
- **Restore** — two steps. Upload a JSON backup: the server validates it
  first and shows a summary without changing anything. Confirm, and the
  backup atomically replaces all progress, journal entries, and findings,
  preserving original ids and timestamps. A bad backup (unknown lab/app/
  plan id, bad status, bad score, duplicate id) is rejected and changes
  nothing.

The server rejects any progress id outside the real curriculum
(`lab-1`–`lab-7`, `app-1`–`app-10`, `plan-1`–`plan-7`). Journal entries
and findings are editable in place. Editors warn about unsaved changes
before you leave the page or restore a backup.

## API

- `GET /api/state` — curriculum + full tracker state
- `GET /api/export` — JSON backup
- `GET /api/export/markdown` — Markdown portfolio
- `POST /api/labs` — save one lab (`labId`, `status`, `writeup`, `toolList`, `promptsUsed`)
- `POST /api/lakera` — save one Lakera app (`appId`, `status`, `score`, `notes`)
- `POST /api/plan` — check/uncheck one plan block (`blockId`, `done`)
- `POST /api/journal`, `PUT /api/journal/:id`, `DELETE /api/journal/:id`
- `POST /api/findings`, `PUT /api/findings/:id`, `DELETE /api/findings/:id`
- `POST /api/import` — restore; `{ state, confirm: true }` applies,
  without `confirm` it only validates and returns a summary

## License

Copyright © 2026 Paris Pehlivanovic. All rights reserved.
