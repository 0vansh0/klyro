# KLYRO

**KLYRO** is an AI-assisted code review, debugging, and developer learning workspace. It combines a React/Vite interface with an Express API to help developers analyze code, preview AI-generated repair suggestions, test selected standalone programs in a restricted Docker environment, and learn from common coding mistakes.

🌐 **Live Demo:** [klyro-pearl.vercel.app](https://klyro-pearl.vercel.app/)

*(Note: The live demo may require production environment variables and configured services for account features and AI-powered functionality. See the deployment and environment sections below.)*

## Features

* **Code Analysis:** Language-specific analyzers with clearly documented coverage.
* **AI Repair Previews:** Request full-file repair suggestions through Google Gemini (when configured).
* **Code Testing:** Run supported standalone languages in a restricted Docker container; preview HTML in a sandboxed frame.
* **Accounts & Review History:** Optional MongoDB-backed accounts and saved reviews in local development.
* **Learning Hub:** AI Mentor, daily challenges, roadmaps, interview practice, recommendations, and progress badges.

## Requirements

* Node.js 20 or newer
* npm
* MongoDB (optional for guest use; account registration and sign-in require it)
* Docker (required for code testing execution)

## Run Locally

1. Copy `.env.example` to `.env`. Set `MONGODB_URI` to enable accounts and server-side review history (guest analysis works without it, but guest code is not saved to history).
2. Install dependencies with `npm install` and `npm install --prefix server`.
3. Start both the API and Vite using `npm run dev`.
4. Open the local Vite URL printed by the command (normally `http://localhost:5173`).

The API binds to `127.0.0.1:5000` by default. The Vite proxy forwards same-origin `/api` requests to that local API, including account cookies. The frontend intentionally uses this same-origin path; public mode also requires one HTTPS app origin and same-origin API requests. API environment variables can be placed in the root `.env` or `server/.env`; root `.env` values are loaded first.

## Analyzer Coverage

| Language | Engine | Coverage |
| --- | --- | --- |
| **HTML** | HTML-Validate recommended rules | HTML standards and markup diagnostics |
| **Python, Java, C, C++, C#, PHP, Lua** | Bundled Tree-sitter grammars | Syntax diagnostics only |
| **FastAPI, Pygame** | Python grammar | Python syntax only; no framework or runtime checks |
| **Spring Boot** | Java grammar | Java syntax only; no framework or build checks |
| **JavaScript, NodeJS** | ESLint | Syntax and configured rules; safe ESLint fixes |
| **React** | ESLint with JSX parsing | JavaScript rules and JSX syntax; no component or build checks; safe ESLint fixes |
| **MySQL, PostgreSQL** | node-sql-parser dialect parsers | SQL syntax for the selected dialect |
| **PL/SQL** | Bundled SQL grammar | Basic SQL syntax only; procedural PL/SQL blocks are not validated |
| **MongoDB, JSON** | Native JSON parser | JSON document syntax; MongoDB operators/query semantics are not validated |

*Note: The API rejects editor profiles outside this list. Syntax parsers detect syntax issues; they do not provide full semantic or type checking. AI repair can generate mistakes; it opens a preview first, and you choose whether to apply it. Without a Gemini key, exact ESLint fixes remain available for JavaScript, NodeJS, and React.*

## Code Testing

* **HTML:** Previews HTML in a sandboxed browser frame with network requests and form submissions blocked.
* **Executable Programs:** Uses Docker with networking disabled, a read-only source mount, dropped Linux capabilities, a read-only container filesystem, memory/CPU/process limits, and a 10-second execution timeout. Standalone JavaScript/NodeJS, Python, Java, C, C++, PHP, and Lua files have runtime images.
* **Analysis-Only:** Framework profiles, SQL/database profiles, JSON, C#, and MongoDB require project-specific dependencies or services and are analysis-only in this runner.

*Docker must be installed and running; the first run may download the selected image. Program output is limited to 32 KB per stream.*

## API Reference

The API is rooted at `/api`.

| Method & Path | Purpose |
| --- | --- |
| `GET /health` | Liveness response and current persistence status |
| `GET /health/live` | Liveness probe; returns 200 while the process can serve requests |
| `GET /health/ready` | Readiness probe; returns 503 when MongoDB was configured but is unavailable |
| `GET /auth/me` | Restore the current signed-in account session |
| `PATCH /auth/profile` | Update the signed-in account display name |
| `POST /auth/register` | Create an account with name, email, and password |
| `POST /auth/login` | Sign in with email and password |
| `POST /auth/verify-email` | Consume a one-time email verification token |
| `POST /auth/verification/resend` | Request a verification link without revealing account existence |
| `POST /auth/password/forgot` | Request a password recovery email without revealing account existence |
| `POST /auth/password/reset` | Consume a one-time password reset token and revoke sessions |
| `POST /auth/logout` | Revoke the current session |
| `DELETE /auth/account` | Delete the signed-in account and its reviews after confirming password |
| `POST /analyze` | Analyze submitted code |
| `POST /repair` | Generate a full-file correction preview |
| `POST /run` | Run one supported standalone language in Docker |
| `GET /capabilities` | Report AI/Docker availability and list runnable profiles |
| `GET /reviews` | Get the most recent 100 reviews for the signed-in account |
| `DELETE /reviews/:id` | Delete one of the signed-in account's reviews by UUID |

## Accounts, MongoDB, and Review Data

When `MONGODB_URI` is omitted, guest analysis still works, but account registration and sign-in respond with 503. Local mode connects at startup and retries every 30 seconds after failures. In public mode, MongoDB is mandatory.

Passwords use Node scrypt; random session tokens are stored as hashes in HttpOnly, SameSite cookies. Public accounts must verify email before signing in. Review documents contain submitted source code. MongoDB review TTL cleanup runs asynchronously.

## Deployment and Security

Public exposure is disabled by default. With `PUBLIC_DEPLOYMENT` unset or false, the API only binds to loopback, and rate limits are process-local.

Public mode requires:
* `PUBLIC_DEPLOYMENT=true`
* `NODE_ENV=production`
* An HTTPS `PUBLIC_APP_URL`
* Exact matching `CLIENT_ORIGINS`
* A correctly scoped `TRUST_PROXY`
* MongoDB replica-set storage
* A configured Resend sender
* Backup-retention/restore-test attestations

### Public Deployment Operator Checklist

1. Complete a deployment-specific security review.
2. Use HTTPS at the trusted ingress, bind the API to the private service network, and set `TRUST_PROXY` accurately.
3. Configure MongoDB with access controls, encryption, replica set, automated backups, a documented retention period, and a tested restore process.
4. Configure Resend with a verified sender domain and deliverability monitoring. Verify signup, resend, recovery, expiry, single-use token behavior, and delivery failure handling in a staging deployment.
5. Keep all secrets in the hosting secret manager and restrict database and mail-provider credentials.
6. Only then enable `PUBLIC_DEPLOYMENT=true`. The startup gate requires a fresh restore-test date (within 90 days) and a declared backup retention of 1–90 days.

## Environment Variables

Keep secrets in local `.env` files or your hosting provider's secret manager. Never commit production credentials or expose server-only keys through frontend variables (e.g., `VITE_*`).

| Variable | Default | Meaning |
| --- | --- | --- |
| `HOST` | 127.0.0.1 | Loopback only by default; public mode requires an externally reachable bind |
| `PUBLIC_DEPLOYMENT` | false | Explicit opt-in to the guarded public deployment mode |
| `PORT` | 5000 | API port |
| `CLIENT_ORIGINS` | local Vite origins | Comma-separated browser origins allowed by CORS |
| `PUBLIC_APP_URL` | unset | Public HTTPS app origin; must exactly match `CLIENT_ORIGINS` |
| `TRUST_PROXY` | unset | Trusted ingress hop count or explicit proxy subnet/trust labels |
| `EMAIL_PROVIDER` | unset | Must be `resend` in public mode |
| `RESEND_API_KEY` | unset | Server-only email API credential |
| `EMAIL_FROM` | unset | Verified sender address/name used for account email |
| `MONGODB_BACKUP_RETENTION_DAYS` | unset | Operator-attested backup retention period required for public mode |
| `MONGODB_BACKUP_RESTORE_TESTED_AT`| unset | ISO date/time of a successful restore test within the last 90 days |
| `API_RATE_LIMIT` | 120 | Requests per IP per 60 seconds across API routes |
| `ANALYZE_RATE_LIMIT` | 30 | Analysis requests per IP per 60 seconds |
| `REPAIR_RATE_LIMIT` | 30 | AI repair requests per IP per 60 seconds |
| `MENTOR_RATE_LIMIT` | 15 | AI Mentor questions per IP per 60 seconds |
| `RUN_RATE_LIMIT` | 10 | Sandboxed runs per IP per 60 seconds |
| `RUN_TIMEOUT_MS` | 10000 | Maximum time for a sandboxed program before it is stopped |
| `REVIEW_RETENTION_DAYS` | 30 | MongoDB TTL retention for submitted code reviews |
| `GEMINI_API_KEY` | unset | Optional server-only Google AI Studio key for repairs and AI Mentor |
| `GEMINI_MODEL` | gemini-3.8-flash | Gemini model used for repair suggestions |
| `MONGODB_URI` | unset | Optional MongoDB connection string |
| `MONGODB_DB` | codesentinel | Database name |
| `CODE_SENTINEL_BACKEND_URL` | http://127.0.0.1:5000 | Vite development proxy target |

## Learning Hub

The Learning Hub includes a Gemini-backed AI Mentor, recurring analyzer-finding summaries, a date-rotating daily challenge, guided roadmaps, interview practice, review/quiz-based lesson recommendations, and progress badges. Learning progress and mentor chat are stored in the current browser profile. `POST /api/mentor` is rate-limited separately by `MENTOR_RATE_LIMIT` and uses the server-only `GEMINI_API_KEY`.

## Tests and Verification

* `npm test` runs backend unit and HTTP API tests without requiring MongoDB.
* `npm run build` builds the frontend.
* `npm run verify:mongo` runs the MongoDB integration smoke check and requires a configured, reachable MongoDB instance. It checks the review TTL index, creates a temporary account and review, verifies save/read/delete, then removes the account.
