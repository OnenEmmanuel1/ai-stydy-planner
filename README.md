# AISSP — AI Smart Study Planner with Emotion-Aware Chat Assistant

AISSP is a Node.js, Express, EJS, and MySQL study planning application. It supports student and administrator accounts, priority-ranked study sessions, progress tracking, in-app reminders, and an adaptive study chat assistant.

## Run with Docker

1. Copy `.env.example` to `.env`, set strong database and session secrets, and configure the correct campus support contact. Seeded demo accounts all use the required password `password123`.
2. Run `docker compose up --build`.
3. Open `http://localhost:3000`. On first boot the app seeds demo accounts and study data.

Demo credentials from the default `.env.example`:

| Role | Email | Password |
|---|---|---|
| Admin | admin@aissp.local | password123 |
| Student | maya@aissp.local | password123 |
| Student | leo@aissp.local | password123 |

All demo credentials are intentionally reset to `password123` by the seed script on every app start. Do not expose this seeded demo outside a local environment. The MySQL volume persists data; to reset a local demo database, remove the `mysql_data` compose volume.

## Environment

`PORT` and `NODE_ENV` configure the server; `SESSION_SECRET` configures session signing; `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` configure MySQL. `DB_ROOT_PASSWORD` sets the MySQL root password. Seed account email addresses can be customized with `ADMIN_EMAIL`, `STUDENT1_EMAIL`, and `STUDENT2_EMAIL`; all seeded account passwords are exactly `password123`. `CAMPUS_COUNSELING_CONTACT` seeds the crisis contact text used in escalation; Admins can edit the active contact in the Administration page. `LLM_API_KEY`, `LLM_MODEL`, and `LLM_BASE_URL` enable an optional OpenAI-compatible chat-completions provider. Keep secrets private.

The UI-UX Pro Max installer was initialized. Its generated `.agents` guidance includes Python scripts that are not part of the app runtime; removing those generated files was blocked by workspace review. Bootstrap 5 via CDN is used for the EJS interface, with flat design tokens in `public/css/tokens.css`.

## System behavior and design decisions

The supplied project material covers Chapters One through Three and contains no Chapter Four, field-level schema, scheduling pseudocode, or named implementation stack. The schema, formula, and stack in this implementation are therefore explicit from-scratch design decisions based on the described entities and workflows.

1. **Emotion detection is rule-based and lexicon-based, not deep learning.** `natural` tokenizes text; curated terms are scored into Stressed, Fatigued, Motivated, Frustrated, or Neutral. Basic negation and intensity modifiers are handled. Admins can extend the stored lexicon. This classification can be wrong and should not be treated as a clinical assessment.
2. **Chat uses deterministic templates by default.** Intent and emotion select an admin-editable response template. If an LLM key is configured, ordinary non-crisis messages may use the optional OpenAI-compatible provider; provider errors fall back to templates. Neither route provides therapy or clinical assessment.
3. **Scheduling uses a weighted priority formula.** `score = urgencyWeight * urgencyFactor + workloadWeight * workloadFactor + preferenceWeight * preferenceFactor`; urgency uses inverse days-until-deadline normalized across the current task set, workload is normalized against 20 hours, and preference maps the user's 1-5 value to 0-1. Default weights are 0.55 urgency, 0.25 workload, and 0.20 preference. Admins can set user-specific weights whose sum must be 1. Tasks are sorted by score, then greedily allocated in 30-minute blocks within availability and before deadlines. Remaining workload is explicitly marked Unscheduled. The heuristic preserves later slots for tasks whose deadlines permit them.
4. **Schema and stack are implementation decisions.** MySQL tables and indexes are defined in `database/schema.sql`; all user-facing SQL values are parameterized. This is a design derived from the source narrative, not a transcription of missing Chapter Four materials.

### Non-negotiable crisis safety path

A private server-side phrase matcher runs before emotion/intent classification, templates, or the optional LLM. A match bypasses both response engines and returns a caring message pointing to the configured campus contact and local emergency support. The LLM cannot override or soften this path. Configure `CAMPUS_COUNSELING_CONTACT` with accurate local resources before use. The system supports academic planning and does not replace professional counselling services.

## Modules

- **Authentication:** session-based login, bcrypt password hashes, invalid-credential feedback, student/admin roles.
- **Planner:** course and task create/read/update/delete endpoints, validated future deadlines, preferences, availability overlap checks, schedule regeneration.
- **Chat:** persisted user/bot history; every user message is classified and logged; crisis messages are flagged and never sent to the LLM.
- **Progress:** task status counts, study sessions, completion endpoint, and a Chart.js view of stored emotion classifications over time.
- **Reminders:** `/api/reminders` returns sessions within 24 hours and deadlines within 48 hours; the navigation badge shows current count.
- **Administration:** manage accounts, shared response templates and lexicon, weights, and inspect activity logs.

## Routes

Pages: `/login`, `/dashboard`, `/planner`, `/chat`, `/admin` (Admin only). JSON API: `/api/tasks`, `/api/courses`, `/api/availability`, `/api/weights`, `/api/chat`, `/api/sessions`, `/api/reminders`, plus `/api/admin/*` content and account management. Student records are scoped by the authenticated user ID; admin-only mutations use role checks.

## Notes

The app uses the native Node `fetch` API for the optional LLM connection (Node 20 image). Bootstrap, Chart.js, and Inter are loaded from CDNs. The LLM integration targets an OpenAI-compatible chat-completions API. For a production deployment, configure HTTPS, a strong session secret, backups, rate limits, CSRF protection, and a persistent session store.
