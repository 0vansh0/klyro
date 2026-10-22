KLYRO
AI-assisted code review, debugging, and developer learning
workspace.

🌐 Live Demo: https://klyro-pearl.vercel.app/

KLYRO combines a React/Vite interface with an Express API to help
developers analyze code, preview AI-generated repair suggestions, test
selected standalone programs in a restricted Docker environment, and
learn from common coding mistakes.

The live demo may require production environment variables and
configured services for account features and AI-powered functionality.
See the deployment and environment sections below.
KLYRO is a local code review workspace with a React/Vite interface and
an Express API. Analyzer profiles have different coverage. KLYRO can
request full-file repair suggestions from the Google Gemini API when
configured, and Test Code runs selected standalone languages in a
restricted Docker container. These features do not imply that every
language or framework can be fully checked or run.
Features
- Code analysis: language-specific analyzers with clearly
  documented coverage.
- AI repair previews: request full-file repair suggestions through
  Google Gemini when configured.
- Code testing: run supported standalone languages in a restricted
  Docker container; preview HTML in a sandboxed frame.
- Accounts and review history: optional MongoDB-backed accounts
  and saved reviews in local development.
- Learning Hub: AI Mentor, daily challenges, roadmaps, interview
  practice, recommendations, and progress badges.
Requirements
- Node.js 20 or newer
- npm
- MongoDB is optional for guest use; account registration and sign-in
  require it
Run locally
1. Copy .env.example to .env. Set MONGODB_URI to enable accounts
and server-side review history; guest analysis works without it, but
guest code is not saved to history.

2. Install dependencies with npm install and
npm install --prefix server.

3. Start both the API and Vite using npm run dev.

4. Open the local Vite URL printed by the command (normally
http\://localhost:5173).

The API binds to 127.0.0.1:5000 by default. The Vite proxy forwards
same-origin /api requests to that local API, including account
cookies. The frontend intentionally uses this same-origin path; public
mode also requires one HTTPS app origin and same-origin API requests.
API environment variables can be placed in the root .env or
server/.env; root .env values are loaded first.
Analyzer coverage
| Language | Engine | Coverage |

| --- | --- | --- |

| HTML | HTML-Validate recommended rules | HTML standards and markup
  diagnostics |

| Python, Java, C, C++, C#, PHP, Lua | Bundled Tree-sitter grammars |
  Syntax diagnostics only |

| FastAPI, Pygame | Python grammar | Python syntax only; no framework
  or runtime checks |

| Spring Boot | Java grammar | Java syntax only; no framework or build
  checks |

| JavaScript, NodeJS | ESLint | Syntax and configured rules
  (no-undef, no-unreachable, no-constant-condition,
  no-unused-vars, eqeqeq, prefer-const); safe ESLint fixes |

| React | ESLint with JSX parsing | JavaScript rules and JSX syntax;
  no component or build checks; safe ESLint fixes |

| MySQL, PostgreSQL | node-sql-parser dialect parsers | SQL syntax
  for the selected dialect |

| PL/SQL | Bundled SQL grammar | Basic SQL syntax only; procedural
  PL/SQL blocks are not validated |

| MongoDB, JSON | Native JSON parser | JSON document syntax; MongoDB
  operators and query semantics are not validated |

The API rejects editor profiles outside this list. Syntax parsers detect
syntax issues; they do not provide full semantic or type checking.
Framework profiles analyze their underlying source language, not a whole
project or its dependencies. SQL analysis does not connect to a database
or validate schemas, names, or query results. AI repair can generate
mistakes; it opens a preview first, and you choose whether to apply it.
Without a Gemini key, exact ESLint fixes remain available for
JavaScript, NodeJS, and React.
Code testing
Test Code previews HTML in a sandboxed browser frame with network
requests and form submissions blocked. For executable programs it uses
Docker with networking disabled, a read-only source mount, dropped Linux
capabilities, a read-only container filesystem, memory/CPU/process
limits, and a 10-second execution timeout. Standalone JavaScript/NodeJS,
Python, Java, C, C++, PHP, and Lua files have runtime images. Framework
profiles, SQL/database profiles, JSON, C#, and MongoDB require
project-specific dependencies or services and are analysis-only in this
runner. Docker must be installed and running; first run may download the
selected image. Program output is limited to 32 KB per stream. AI repair
sends the source and findings to the configured Gemini API; do not
submit code you are not allowed to share with that provider.
API reference
The API is rooted at /api.

| Method and path | Purpose |

| --- | --- |

| GET /health | Liveness response and current persistence status |

| GET /health/live | Liveness probe; returns 200 while the process
  can serve requests |

| GET /health/ready | Readiness probe; returns 503 when MongoDB was
  configured but is unavailable |

| GET /auth/me | Restore the current signed-in account session |

| PATCH /auth/profile | Update the signed-in account display name
  with name |

| POST /auth/register | Create an account with name, email, and
  password |

| POST /auth/login | Sign in with email and password |

| POST /auth/verify-email | Consume a one-time email verification
  token |

| POST /auth/verification/resend | Request a verification link
  without revealing account existence |

| POST /auth/password/forgot | Request a password recovery email
  without revealing account existence |

| POST /auth/password/reset | Consume a one-time password reset token
  and revoke sessions |

| POST /auth/logout | Revoke the current session |

| DELETE /auth/account | Delete the signed-in account and its reviews
  after confirming password |

| POST /analyze | Analyze submitted code; body fields: code,
  language, optional mode, fileId, fileName, and autoFix |

| POST /repair | Generate a full-file correction preview; body
  fields: code, language, optional fileName, and analyzer
  findings |

| POST /run | Run one supported standalone language in Docker; body
  fields: code, language, and optional stdin input |

| GET /capabilities | Report whether AI repair and Docker execution
  are available and list runnable profiles |

| GET /reviews | Get the most recent 100 reviews for the signed-in
  account |

| DELETE /reviews/:id | Delete one of the signed-in account's reviews
  by UUID |

mode accepts eslint, syntax, or the legacy alias static.
language accepts a profile in the Analyzer coverage table. fileId is
limited to 128 identifier characters. fileName must be a printable
basename up to 255 characters. Code is limited to 50,000 characters and
JSON request bodies to 100 KB. Invalid bodies and fields return JSON
errors with a 4xx status. Requests are rate limited over 60-second
windows; local mode stores counters in process memory, while public mode
uses MongoDB shared counters and refuses requests if that store is
unavailable. Defaults are 120 API requests, 30 analysis requests, 30
repairs, 10 runs, 10 login attempts, 5 registrations, and 3 each for
email verification and password recovery actions.
Accounts, MongoDB, and review data
When MONGODB_URI is omitted, guest analysis still works but account
registration and sign-in respond with 503. Local mode connects at
startup and retries every 30 seconds after failures. In public mode,
MongoDB is mandatory and the service refuses to start unless it can
connect to a replica set. Passwords use Node scrypt; random session
tokens are stored as hashes in HttpOnly, SameSite cookies (7-day
lifetime in public mode). Public accounts must verify email before
signing in. Verification and password reset links are one-time MongoDB
tokens with 24-hour and 30-minute expiry; password reset revokes all
sessions. Review documents contain submitted source code. MongoDB review
TTL cleanup runs asynchronously; backups can retain deleted or expired
records until their configured expiration. Account deletion
transactionally removes the live account, reviews, sessions, and account
tokens. Operators must define and disclose backup retention and deletion
timelines and regularly prove restore and expiry behavior.
Deployment and security
Public exposure is **disabled by default**. With PUBLIC_DEPLOYMENT
unset or false, the API only binds to loopback and rate limits are
process-local. Public mode requires PUBLIC_DEPLOYMENT=true,
NODE_ENV=production, an HTTPS PUBLIC_APP_URL, exact matching
CLIENT_ORIGINS, a correctly scoped TRUST_PROXY, MongoDB replica-set
storage, a configured Resend sender, and backup-retention/restore-test
attestations. Startup fails closed if a requirement is missing or
MongoDB/shared rate-limit storage is unavailable. The server uses secure
cookies, HTTPS enforcement, exact origin/referer checks and Fetch
Metadata rejection for state-changing requests, security headers, shared
MongoDB rate limits, email verification, password recovery, and
transactional account deletion. Do not expose the application until the
infrastructure and operational checklist below is complete.

For Vercel, the checked-in vercel.json builds the Vite frontend and
routes same-origin /api/\* requests to api/index.js, which
initializes the MongoDB-backed API and refuses requests until
public-mode prerequisites pass. The install command installs both the
root frontend and server backend dependencies. Set the public-mode
environment variables in Vercel for the Production environment and
redeploy; local .env files are not uploaded by Vercel.
Public deployment operator checklist
1. Complete a deployment-specific security review, including dependency
audit, threat model, auth/session review, CORS/origin checks, and
external security testing. The application code has been reviewed for
the public-mode boundary; this is not a penetration test or a substitute
for your hosting provider's review.

2. Use HTTPS at the trusted ingress, bind the API to the private
service network (commonly 0.0.0.0 inside a container), and set
TRUST_PROXY only to the actual proxy hop count or trusted proxy
subnet. Keep frontend and API on the same origin; do not expose the API
directly.

3. Configure MongoDB with access controls, encryption, replica set,
automated backups, a documented retention period, and a tested restore
process. Set MONGODB_BACKUP_RETENTION_DAYS and
MONGODB_BACKUP_RESTORE_TESTED_AT only after these are real and
verified. These values are operator attestations; the application cannot
create or verify provider backups. Ensure account deletion is disclosed
as removing live data immediately while retained backups expire on the
stated schedule.

4. Configure Resend with a verified sender domain and deliverability
monitoring. Set the server-only email credentials. Verify signup,
resend, recovery, expiry, single-use token behavior, and delivery
failure handling in a staging deployment.

5. Keep all secrets in the hosting secret manager, restrict database
and mail-provider credentials, enable log/alert monitoring, and verify
health/readiness behavior during database and mail-provider outages.
Never commit production .env files.

6. Only then enable PUBLIC_DEPLOYMENT=true. The startup gate requires
a fresh restore-test date (within 90 days) and a declared backup
retention of 1--90 days. /api/health/ready reports non-secret
configuration blockers.

Database-backed rate limits are shared across API instances and fail
closed if unavailable. They use a hashed client identity and are
automatically expired. Email recovery endpoints return generic responses
to reduce account enumeration. The currently supported email provider is
Resend.
Environment variables
Keep secrets in local .env files or your hosting provider's secret
manager. Never commit production credentials or expose server-only keys
through frontend variables such as VITE_*.

| Variable | Default | Meaning |

| --- | --- | --- |

| HOST | 127.0.0.1 | Loopback only by default; public mode
  requires an externally reachable bind such as 0.0.0.0 behind a
  trusted ingress |

| PUBLIC_DEPLOYMENT | false | Explicit opt-in to the guarded
  public deployment mode |

| PORT | 5000 | API port |

| CLIENT_ORIGINS | local Vite origins | Comma-separated browser
  origins allowed by CORS |

| PUBLIC_APP_URL | unset | Public HTTPS app origin; must exactly
  match the sole CLIENT_ORIGINS entry |

| TRUST_PROXY | unset | Trusted ingress hop count or explicit proxy
  subnet/trust labels; must match hosting topology |

| EMAIL_PROVIDER | unset | Must be resend in public mode |

| RESEND_API_KEY | unset | Server-only email API credential |

| EMAIL_FROM | unset | Verified sender address/name used for account
  email |

| MONGODB_BACKUP_RETENTION_DAYS | unset | Operator-attested backup
  retention period required for public mode |

| MONGODB_BACKUP_RESTORE_TESTED_AT | unset | ISO date/time of a
  successful restore test within the last 90 days |

| API_RATE_LIMIT | 120 | Requests per IP per 60 seconds across API
  routes |

| ANALYZE_RATE_LIMIT | 30 | Analysis requests per IP per 60
  seconds |

| REPAIR_RATE_LIMIT | 30 | AI repair requests per IP per 60
  seconds |

| MENTOR_RATE_LIMIT | 15 | AI Mentor questions per IP per 60
  seconds |

| RUN_RATE_LIMIT | 10 | Sandboxed runs per IP per 60 seconds |

| RUN_TIMEOUT_MS | 10000 | Maximum time for a sandboxed program
  before it is stopped |

| REVIEW_RETENTION_DAYS | 30 | MongoDB TTL retention for submitted
  code reviews |

| GEMINI_API_KEY | unset | Optional server-only Google AI Studio key
  for repairs and AI Mentor; never expose it through a VITE\_ variable
  |

| GEMINI_MODEL | gemini-3.8-flash | Gemini model used for repair
  suggestions |

| MONGODB_URI | unset | Optional MongoDB connection string |

| MONGODB_DB | codesentinel | Database name |

| CODE_SENTINEL_BACKEND_URL | http\://127.0.0.1:5000 | Vite
  development proxy target |

Use the root .env.example as the local-development template. It
contains placeholders only; keep credentials out of source control.

For local AI repair and AI Mentor, create a file named .env in the
project root (the same folder as package.json) and set
GEMINI_API_KEY=your_key_here. Fully stop and restart npm run dev
after changing the key because the API reads its credentials when it
starts. AI repair sends the selected source code to Gemini for every
supported editor profile. AI Mentor sends your question and optional
selected finding text; it does not send the editor source. Without a
key, lessons, roadmaps, challenges, interview practice, review-based
recommendations, and achievements still work; only AI Mentor replies and
AI repairs need Gemini.
Learning Hub
The Learning Hub includes a Gemini-backed AI Mentor, recurring
analyzer-finding summaries, a date-rotating daily challenge with
progressive hints, guided JavaScript/React/full-stack roadmaps,
interview practice, review- and quiz-based lesson recommendations, and
progress badges. Learning progress and mentor chat are stored in the
current browser profile; review-based features use the review history
available to that profile. The daily challenge comes from a curated
challenge set. POST /api/mentor is rate-limited separately by
MENTOR_RATE_LIMIT and uses the server-only GEMINI_API_KEY.
Tests and verification
- npm test runs backend unit and HTTP API tests without requiring
  MongoDB.
- npm run build builds the frontend.
- npm run verify:mongo runs the MongoDB integration smoke check and
  requires a configured, reachable MongoDB instance. It checks the
  review TTL index, creates a temporary account and review, verifies
  save/read/delete, then removes the account.
The API test suite covers JavaScript and JSON analysis,
unsupported-language and metadata validation, malformed request
handling, CORS rejection, rate limiting, health behavior, account
registration/login/logout/session expiry/deletion, per-account review
isolation, Gemini rate-limit handling, Docker execution/timeouts, mocked
MongoDB outage/reconnect, review persistence, and legacy TTL-index
migration. Run npm run verify:mongo against a configured MongoDB
instance to check the live TTL index and save/read/delete behavior.
Deeper type/semantic analysis, dependency checks, and project-level
execution remain future product work; most current language profiles
perform syntax parsing, and Docker runs only selected standalone
languages.