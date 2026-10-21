# KLYRO

KLYRO is a local code review workspace with a React/Vite interface and an Express API. Analyzer profiles have different coverage. KLYRO can request full-file repair suggestions from the Google Gemini API when configured, and Test Code runs selected standalone languages in a restricted Docker container. These features do not imply that every language or framework can be fully checked or run.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB is optional for guest use; account registration and sign-in require it

## Run locally

1. Copy `.env.example` to `.env`. Set `MONGODB_URI` to enable accounts and server-side review history; guest analysis works without it, but guest code is not saved to history.
2. Install dependencies with `npm install` and `npm install --prefix server`.
3. Start both the API and Vite using `npm run dev`.
4. Open the local Vite URL printed by the command (normally `http://localhost:5173`).

The API binds to `127.0.0.1:5000` by default. The Vite proxy forwards same-origin `/api` requests to that local API, including account cookies. The frontend intentionally uses this same-origin path; a separate frontend/API origin is unsupported until credentialed CORS and CSRF protections are implemented. API environment variables can be placed in the root `.env` or `server/.env`; root `.env` values are loaded first.

## Analyzer coverage

| Language | Engine | Coverage |
| --- | --- | --- |
| HTML | HTML-Validate recommended rules | HTML standards and markup diagnostics |
| Python, Java, C, C++, C#, PHP, Lua | Bundled Tree-sitter grammars | Syntax diagnostics only |
| FastAPI, Pygame | Python grammar | Python syntax only; no framework or runtime checks |
| Spring Boot | Java grammar | Java syntax only; no framework or build checks |
| JavaScript, NodeJS | ESLint | Syntax and configured rules (`no-undef`, `no-unreachable`, `no-constant-condition`, `no-unused-vars`, `eqeqeq`, `prefer-const`); safe ESLint fixes |
| React | ESLint with JSX parsing | JavaScript rules and JSX syntax; no component or build checks; safe ESLint fixes |
| MySQL, PostgreSQL | `node-sql-parser` dialect parsers | SQL syntax for the selected dialect |
| PL/SQL | Bundled SQL grammar | Basic SQL syntax only; procedural PL/SQL blocks are not validated |
| MongoDB, JSON | Native JSON parser | JSON document syntax; MongoDB operators and query semantics are not validated |

The API rejects editor profiles outside this list. Syntax parsers detect syntax issues; they do not provide full semantic or type checking. Framework profiles analyze their underlying source language, not a whole project or its dependencies. SQL analysis does not connect to a database or validate schemas, names, or query results. AI repair can generate mistakes; it opens a preview first, and you choose whether to apply it. Without a Gemini key, exact ESLint fixes remain available for JavaScript, NodeJS, and React.

### Code testing

`Test Code` previews HTML in a sandboxed browser frame with network requests and form submissions blocked. For executable programs it uses Docker with networking disabled, a read-only source mount, dropped Linux capabilities, a read-only container filesystem, memory/CPU/process limits, and a 10-second execution timeout. Standalone JavaScript/NodeJS, Python, Java, C, C++, PHP, and Lua files have runtime images. Framework profiles, SQL/database profiles, JSON, C#, and MongoDB require project-specific dependencies or services and are analysis-only in this runner. Docker must be installed and running; first run may download the selected image. Program output is limited to 32 KB per stream. AI repair sends the source and findings to the configured Gemini API; do not submit code you are not allowed to share with that provider.

## API

The API is rooted at `/api`.

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Liveness response and current persistence status |
| `GET /health/live` | Liveness probe; returns `200` while the process can serve requests |
| `GET /health/ready` | Readiness probe; returns `503` when MongoDB was configured but is unavailable |
| `GET /auth/me` | Restore the current signed-in account session |
| `PATCH /auth/profile` | Update the signed-in account display name with `name` |
| `POST /auth/register` | Create an account with `name`, `email`, and `password` |
| `POST /auth/login` | Sign in with `email` and `password` |
| `POST /auth/logout` | Revoke the current session |
| `DELETE /auth/account` | Delete the signed-in account and its reviews after confirming `password` |
| `POST /analyze` | Analyze submitted code; body fields: `code`, `language`, optional `mode`, `fileId`, `fileName`, and `autoFix` |
| `POST /repair` | Generate a full-file correction preview; body fields: `code`, `language`, optional `fileName`, and analyzer `findings` |
| `POST /run` | Run one supported standalone language in Docker; body fields: `code`, `language`, and optional stdin `input` |
| `GET /capabilities` | Report whether AI repair and Docker execution are available and list runnable profiles |
| `GET /reviews` | Get the most recent 100 reviews for the signed-in account |
| `DELETE /reviews/:id` | Delete one of the signed-in account's reviews by UUID |

`mode` accepts `eslint`, `syntax`, or the legacy alias `static`. `language` accepts a profile in the Analyzer coverage table. `fileId` is limited to 128 identifier characters. `fileName` must be a printable basename up to 255 characters. Code is limited to 50,000 characters and JSON request bodies to 100 KB. Invalid bodies and fields return JSON errors with a `4xx` status. Requests are rate limited per client IP over a 60-second window; defaults are 120 API requests, 30 analysis requests, 30 repairs, 10 runs, 10 login attempts, and 5 account registrations.

## MongoDB and review data

When `MONGODB_URI` is omitted, guest analysis still works but review history is not stored in the browser; account registration and sign-in respond with `503`. When MongoDB is configured, the API attempts to connect during startup and retries every 30 seconds after a failure. During an outage, analysis continues, new reviews are not persisted, `/health/live` remains `200`, and `/health/ready` returns `503`. Once MongoDB reconnects, persistence resumes. Passwords are hashed with Node's scrypt; session tokens are random, stored as hashes, and sent in HttpOnly SameSite cookies that expire after 30 days. Login attempts are rate limited. Review documents contain submitted source code, so treat the local MongoDB database and its backups as sensitive data. MongoDB automatically expires review documents after 30 days by default (`REVIEW_RETENTION_DAYS`); startup upgrades the existing date index with `collMod`, or rebuilds only that index on MongoDB versions that cannot alter its TTL option. TTL cleanup runs asynchronously, and backups may retain old copies. Signed-in users can update their display name on **My Profile**, and delete their account from that page or with `DELETE /auth/account`; deletion removes their reviews, sessions, and account. Password reset emails are not configured in this prototype.

## Single-user and deployment boundary

This remains a **local-only prototype**. Account sessions and persisted review history are scoped per user, and the server rejects non-loopback `HOST` values. Do not expose it through a public ingress, reverse proxy, or shared network. Public deployment is not enabled: it requires a broader security review, password recovery, email verification, stronger CSRF/origin protections, a shared rate-limit store across instances, and operational review of backups and deletion guarantees. Rate limits are currently in memory and reset on restart.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | API bind host; loopback hosts only |
| `PORT` | `5000` | API port |
| `CLIENT_ORIGINS` | local Vite origins | Comma-separated browser origins allowed by CORS |
| `API_RATE_LIMIT` | `120` | Requests per IP per 60 seconds across API routes |
| `ANALYZE_RATE_LIMIT` | `30` | Analysis requests per IP per 60 seconds |
| `REPAIR_RATE_LIMIT` | `30` | AI repair requests per IP per 60 seconds |
| `MENTOR_RATE_LIMIT` | `15` | AI Mentor questions per IP per 60 seconds |
| `RUN_RATE_LIMIT` | `10` | Sandboxed runs per IP per 60 seconds |
| `RUN_TIMEOUT_MS` | `10000` | Maximum time for a sandboxed program before it is stopped |
| `REVIEW_RETENTION_DAYS` | `30` | MongoDB TTL retention for submitted code reviews |
| `GEMINI_API_KEY` | unset | Optional server-only Google AI Studio key for repairs and AI Mentor; never expose it through a `VITE_` variable |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Gemini model used for repair suggestions |
| `MONGODB_URI` | unset | Optional MongoDB connection string |
| `MONGODB_DB` | `codesentinel` | Database name |
| `CODE_SENTINEL_BACKEND_URL` | `http://127.0.0.1:5000` | Vite development proxy target |

Use the root `.env.example` as the local-development template. It contains placeholders only; keep credentials out of source control.

For local AI repair and AI Mentor, create a file named `.env` in the project root (the same folder as `package.json`) and set `GEMINI_API_KEY=your_key_here`. Fully stop and restart `npm run dev` after changing the key because the API reads its credentials when it starts. AI repair sends the selected source code to Gemini for every supported editor profile. AI Mentor sends your question and optional selected finding text; it does not send the editor source. Without a key, lessons, roadmaps, challenges, interview practice, review-based recommendations, and achievements still work; only AI Mentor replies and AI repairs need Gemini.

## Learning Hub

The Learning Hub includes a Gemini-backed AI Mentor, recurring analyzer-finding summaries, a date-rotating daily challenge with progressive hints, guided JavaScript/React/full-stack roadmaps, interview practice, review- and quiz-based lesson recommendations, and progress badges. Learning progress and mentor chat are stored in the current browser profile; review-based features use the review history available to that profile. The daily challenge comes from a curated challenge set. `POST /api/mentor` is rate-limited separately by `MENTOR_RATE_LIMIT` and uses the server-only `GEMINI_API_KEY`.

## Verification

- `npm test` runs backend unit and HTTP API tests without requiring MongoDB.
- `npm run build` builds the frontend.
- `npm run verify:mongo` runs the MongoDB integration smoke check and requires a configured, reachable MongoDB instance. It checks the review TTL index, creates a temporary account and review, verifies save/read/delete, then removes the account.

The API test suite covers JavaScript and JSON analysis, unsupported-language and metadata validation, malformed request handling, CORS rejection, rate limiting, health behavior, account registration/login/logout/session expiry/deletion, per-account review isolation, Gemini rate-limit handling, Docker execution/timeouts, mocked MongoDB outage/reconnect, review persistence, and legacy TTL-index migration. Run `npm run verify:mongo` against a configured MongoDB instance to check the live TTL index and save/read/delete behavior. Deeper type/semantic analysis, dependency checks, and project-level execution remain future product work; most current language profiles perform syntax parsing, and Docker runs only selected standalone languages.
