import test, { after, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { app, connectMongo, resetRateLimitsForTests, setAuthCollectionsForTests, setDockerForTests, setMongoForTests, setRepairProviderForTests, setReviewsCollectionForTests } from "./server.js";

let server;
let baseUrl;
let storedReviews;
let activeCollection;
let storedUsers;
let storedSessions;

function createCollection() {
  storedReviews = new Map();
  activeCollection = {
    db: { command: async () => ({ ok: 1 }) },
    insertOne: async (document) => {
      storedReviews.set(document._id, structuredClone(document));
      return { acknowledged: true };
    },
    find: ({ userId } = {}) => ({
      sort() { return this; },
      limit() { return this; },
      toArray: async () => [...storedReviews.values()]
        .filter((item) => userId === undefined || item.userId === userId)
        .map((item) => structuredClone(item)),
    }),
    deleteOne: async ({ _id, userId }) => {
      const stored = storedReviews.get(_id);
      if (!stored || (userId !== undefined && stored.userId !== userId)) return { deletedCount: 0 };
      storedReviews.delete(_id);
      return { deletedCount: 1 };
    },
    deleteMany: async ({ userId }) => {
      let deletedCount = 0;
      for (const [id, item] of storedReviews) {
        if (item.userId === userId) {
          storedReviews.delete(id);
          deletedCount += 1;
        }
      }
      return { deletedCount };
    },
  };
  setReviewsCollectionForTests(activeCollection);
}

function createAuthCollections() {
  storedUsers = new Map();
  storedSessions = new Map();
  const users = {
    createIndex: async () => {},
    insertOne: async (document) => {
      if ([...storedUsers.values()].some((user) => user.email === document.email)) {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      storedUsers.set(document._id, structuredClone(document));
      return { acknowledged: true };
    },
    findOne: async (query) => {
      const user = query.email
        ? [...storedUsers.values()].find((item) => item.email === query.email)
        : storedUsers.get(query._id);
      return user ? structuredClone(user) : null;
    },
    updateOne: async ({ _id }, update) => {
      const user = storedUsers.get(_id);
      if (!user) return { matchedCount: 0, modifiedCount: 0 };
      Object.assign(user, update.$set || {});
      return { matchedCount: 1, modifiedCount: 1 };
    },
    deleteOne: async ({ _id }) => ({ deletedCount: storedUsers.delete(_id) ? 1 : 0 }),
  };
  const sessions = {
    createIndex: async () => {},
    insertOne: async (document) => {
      storedSessions.set(document.tokenHash, structuredClone(document));
      return { acknowledged: true };
    },
    findOne: async ({ tokenHash, expiresAt }) => {
      const session = storedSessions.get(tokenHash);
      return session && session.expiresAt > expiresAt.$gt ? structuredClone(session) : null;
    },
    deleteOne: async ({ tokenHash }) => ({ deletedCount: storedSessions.delete(tokenHash) ? 1 : 0 }),
    deleteMany: async ({ userId }) => {
      let deletedCount = 0;
      for (const [tokenHash, session] of storedSessions) {
        if (session.userId === userId) {
          storedSessions.delete(tokenHash);
          deletedCount += 1;
        }
      }
      return { deletedCount };
    },
  };
  setAuthCollectionsForTests({ users, sessions });
}

async function jsonRequest(route, options) {
  const response = await fetch(`${baseUrl}${route}`, options);
  return { response, body: await response.json() };
}

async function registerUser({ name = "Test User", email = `user-${Math.random()}@example.test`, password = "safe-password-123" } = {}) {
  const { response, body } = await jsonRequest("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  assert.equal(response.status, 201, body.error);
  return { email, password, user: body.user, cookie: response.headers.get("set-cookie")?.split(";", 1)[0] };
}

async function authenticatedJsonRequest(cookie, route, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Cookie", cookie);
  return jsonRequest(route, { ...options, headers });
}

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  setReviewsCollectionForTests(null);
  setAuthCollectionsForTests();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

afterEach(() => {
  setReviewsCollectionForTests(null);
  setAuthCollectionsForTests();
  setDockerForTests();
  setRepairProviderForTests(process.env.GEMINI_API_KEY);
  setMongoForTests({ uri: process.env.MONGODB_URI });
  resetRateLimitsForTests();
});

test("JavaScript analysis reports ESLint findings", async () => {
  const { response, body } = await jsonRequest("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "const value = 1;", language: "JavaScript" }),
  });
  assert.equal(response.status, 200);
  assert.equal(body.engine, "ESLint");
  assert.ok(body.findings.some((finding) => finding.ruleId === "no-unused-vars"));
});

test("review strictness changes ESLint findings and rejects invalid custom rules", async () => {
  const request = (payload) => jsonRequest("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: 'eval("1 + 1");', language: "JavaScript", ...payload }),
  });
  const standard = await request({ strictness: "standard" });
  const security = await request({ strictness: "security" });
  assert.equal(standard.response.status, 200);
  assert.equal(security.response.status, 200);
  assert.ok(security.body.findings.some((finding) => finding.ruleId === "no-eval" && finding.severity === "error"));

  const custom = await jsonRequest("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "debugger;", language: "JavaScript", customRules: { "no-debugger": "error" } }),
  });
  assert.equal(custom.response.status, 200);
  assert.ok(custom.body.findings.some((finding) => finding.ruleId === "no-debugger"));

  const rejected = await request({ customRules: { "no-evil-plugin": "error" } });
  assert.equal(rejected.response.status, 400);
});

test("JSON analysis detects invalid syntax", async () => {
  const { response, body } = await jsonRequest("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: '{ "broken": }', language: "JSON" }),
  });
  assert.equal(response.status, 200);
  assert.equal(body.engine, "JSON parser");
  assert.equal(body.findings[0].ruleId, "invalid-json");
});

test("JavaScript autofix applies ESLint safe fixes and returns corrected source", async () => {
  const { response, body } = await jsonRequest("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: "let value = 1;",
      language: "JavaScript",
      autoFix: true,
    }),
  });
  assert.equal(response.status, 200);
  assert.match(body.correctedCode, /const value = 1/);
});

test("unknown editor profiles are rejected instead of receiving structure-only checks", async () => {
  const { response, body } = await jsonRequest("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "package main", language: "Go" }),
  });
  assert.equal(response.status, 400);
  assert.match(body.error, /Unsupported editor profile/);
});

test("analysis validates identifiers, filenames, and autofix options", async () => {
  for (const invalid of [
    { fileId: "../secret" },
    { fileName: "../secret.js" },
    { autoFix: "true" },
  ]) {
    const { response } = await jsonRequest("/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "const a = 1;", language: "JavaScript", ...invalid }),
    });
    assert.equal(response.status, 400);
  }
});

test("malformed JSON request bodies return a consistent client error", async () => {
  const response = await fetch(`${baseUrl}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"code":',
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /valid JSON/);
});

test("health distinguishes liveness and database readiness", async () => {
  const live = await jsonRequest("/health/live");
  assert.equal(live.response.status, 200);
  assert.equal(live.body.status, "ok");
  const ready = await jsonRequest("/health/ready");
  assert.ok([200, 503].includes(ready.response.status));
  assert.ok(["ready", "not_ready"].includes(ready.body.status));
});

test("account setup explains when the MongoDB URI still has its password placeholder", async () => {
  setMongoForTests({ uri: "mongodb+srv://user:<db_password>@cluster.example/" });
  const { response, body } = await jsonRequest("/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", email: "test@example.test", password: "safe-password-123" }),
  });
  assert.equal(response.status, 503);
  assert.match(body.error, /still contains <db_password>/);
  assert.match(body.error, /restart npm run dev/);
});

test("CORS rejects unconfigured browser origins", async () => {
  const response = await fetch(`${baseUrl}/health`, { headers: { Origin: "https://untrusted.example" } });
  assert.equal(response.status, 403);
});

test("analysis persists history and review deletion removes it", async () => {
  createCollection();
  createAuthCollections();
  const { cookie, user } = await registerUser();
  const analyzed = await authenticatedJsonRequest(cookie, "/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "const value = 1;", language: "JavaScript", fileName: "sample.js" }),
  });
  assert.equal(analyzed.response.status, 200);
  assert.equal(analyzed.body.persisted, true);
  const reviewId = analyzed.body.reviewId;
  assert.equal([...storedReviews.values()][0].userId, user.id);

  const history = await authenticatedJsonRequest(cookie, "/reviews");
  assert.equal(history.response.status, 200);
  assert.equal(history.body.reviews[0].id, reviewId);
  assert.equal(history.body.reviews[0].code, "const value = 1;");

  const deleted = await authenticatedJsonRequest(cookie, `/reviews/${reviewId}`, { method: "DELETE" });
  assert.equal(deleted.response.status, 200);
  assert.equal(storedReviews.size, 0);
});

test("malformed review identifiers are rejected", async () => {
  createAuthCollections();
  const { cookie } = await registerUser();
  const { response } = await authenticatedJsonRequest(cookie, "/reviews/not-a-uuid", { method: "DELETE" });
  assert.equal(response.status, 400);
});

test("review routes require authentication", async () => {
  createAuthCollections();
  const history = await jsonRequest("/reviews");
  assert.equal(history.response.status, 401);
  const deletion = await jsonRequest("/reviews/00000000-0000-4000-8000-000000000000", { method: "DELETE" });
  assert.equal(deletion.response.status, 401);
});

test("guest code reviews are analyzed but never persisted as review history", async () => {
  createCollection();
  const result = await jsonRequest("/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "const value = 1;", language: "JavaScript" }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.persisted, false);
  assert.equal(result.body.persistenceStatus, "sign_in_required");
  assert.equal(storedReviews.size, 0);
});

test("account registration, login, logout, and expired sessions work", async () => {
  createAuthCollections();
  const account = await registerUser();
  assert.equal(storedSessions.size, 1);

  const signedIn = await jsonRequest("/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  assert.equal(signedIn.response.status, 200);
  const loginCookie = signedIn.response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(loginCookie);

  const logout = await authenticatedJsonRequest(loginCookie, "/auth/logout", { method: "POST" });
  assert.equal(logout.response.status, 200);
  const afterLogout = await authenticatedJsonRequest(loginCookie, "/auth/me");
  assert.equal(afterLogout.body.authenticated, false);

  const activeTokenHash = [...storedSessions.keys()][0];
  storedSessions.get(activeTokenHash).expiresAt = new Date(0);
  const expired = await authenticatedJsonRequest(account.cookie, "/auth/me");
  assert.equal(expired.body.authenticated, false);
});

test("profile changes require sign-in and update the account display name", async () => {
  createAuthCollections();
  const unauthenticated = await jsonRequest("/auth/profile", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Updated Name" }),
  });
  assert.equal(unauthenticated.response.status, 401);

  const account = await registerUser();
  const invalid = await authenticatedJsonRequest(account.cookie, "/auth/profile", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "  " }),
  });
  assert.equal(invalid.response.status, 400);

  const updated = await authenticatedJsonRequest(account.cookie, "/auth/profile", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "  Updated Name  " }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.user.name, "Updated Name");
  assert.equal((await jsonRequest("/auth/me", { headers: { Cookie: account.cookie } })).body.user.name, "Updated Name");
});

test("account deletion verifies password and removes owned data and sessions", async () => {
  createCollection();
  createAuthCollections();
  const account = await registerUser();
  const analyzed = await authenticatedJsonRequest(account.cookie, "/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "const value = 1;", language: "JavaScript" }),
  });
  assert.equal(analyzed.body.persisted, true);

  const wrongPassword = await authenticatedJsonRequest(account.cookie, "/auth/account", {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong-password" }),
  });
  assert.equal(wrongPassword.response.status, 401);
  assert.equal(storedReviews.size, 1);

  const deleted = await authenticatedJsonRequest(account.cookie, "/auth/account", {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: account.password }),
  });
  assert.equal(deleted.response.status, 200);
  assert.equal(storedUsers.size, 0);
  assert.equal(storedSessions.size, 0);
  assert.equal(storedReviews.size, 0);
  assert.match(deleted.response.headers.get("set-cookie"), /Max-Age=0/);
});

test("review history and deletion are isolated by account", async () => {
  createCollection();
  createAuthCollections();
  const first = await registerUser();
  const second = await registerUser();
  const analyzed = await authenticatedJsonRequest(first.cookie, "/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "const value = 1;", language: "JavaScript" }),
  });
  assert.equal(analyzed.body.persisted, true);
  const reviewId = analyzed.body.reviewId;

  const secondHistory = await authenticatedJsonRequest(second.cookie, "/reviews");
  assert.equal(secondHistory.body.reviews.length, 0);
  const secondDelete = await authenticatedJsonRequest(second.cookie, `/reviews/${reviewId}`, { method: "DELETE" });
  assert.equal(secondDelete.response.status, 404);
  assert.equal(storedReviews.size, 1);
});

test("repair returns a useful response when Gemini is rate limited", async () => {
  setRepairProviderForTests("test-only-key");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (!String(url).includes("generativelanguage.googleapis.com")) return originalFetch(url, options);
    return new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED", message: "test quota" } }), { status: 429 });
  };
  try {
    const { response, body } = await jsonRequest("/repair", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "<h1>hi", language: "HTML" }),
    });
    assert.equal(response.status, 503);
    assert.match(body.error, /quota or rate limit/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI mentor sends a bounded conversation to Gemini and returns a plain-language reply", async () => {
  setRepairProviderForTests("test-only-key");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (!String(url).includes("generativelanguage.googleapis.com")) return originalFetch(url, options);
    const requestBody = JSON.parse(options.body);
    assert.equal(requestBody.contents.at(-1).role, "user");
    assert.match(requestBody.systemInstruction.parts[0].text, /untrusted data/);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "A closure remembers values from where it was created." }] } }] }), { status: 200 });
  };
  try {
    const { response, body } = await jsonRequest("/mentor", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "What is a closure?",
        history: [{ role: "user", text: "I am learning JavaScript." }, { role: "model", text: "Let's use a simple example." }],
        context: { topic: "JavaScript", language: "JavaScript" },
      }),
    });
    assert.equal(response.status, 200);
    assert.match(body.answer, /remembers values/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI mentor validates input and reports missing server credentials", async () => {
  setRepairProviderForTests(null);
  const invalid = await jsonRequest("/mentor", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "   " }),
  });
  assert.equal(invalid.response.status, 400);
  const unavailable = await jsonRequest("/mentor", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Explain this error" }),
  });
  assert.equal(unavailable.response.status, 503);
  assert.match(unavailable.body.error, /GEMINI_API_KEY/);
});

test("Docker runner reports successful output and execution timeouts", async () => {
  let shouldHang = false;
  let runChild;
  const fakeSpawn = (_command, args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = () => child.emit("close", 143);
    if (args[0] === "version") {
      queueMicrotask(() => child.emit("close", 0));
    } else if (args[0] === "kill") {
      queueMicrotask(() => {
        child.emit("close", 0);
        runChild?.emit("close", 137);
      });
    } else if (args[0] === "run") {
      runChild = child;
      if (!shouldHang) queueMicrotask(() => { child.stdout.write("hello\n"); child.emit("close", 0); });
    }
    return child;
  };
  setDockerForTests({ spawn: fakeSpawn, timeoutMs: 15 });

  const success = await jsonRequest("/run", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "console.log('hello')", language: "JavaScript" }),
  });
  assert.equal(success.response.status, 200);
  assert.equal(success.body.stdout, "hello\n");
  assert.equal(success.body.status, "success");

  shouldHang = true;
  const timedOut = await jsonRequest("/run", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "while(true){}", language: "JavaScript" }),
  });
  assert.equal(timedOut.response.status, 200);
  assert.equal(timedOut.body.timedOut, true);
  assert.equal(timedOut.body.status, "timeout");
});

test("MongoDB outage marks readiness unavailable and a reconnect restores it", async () => {
  let failPing = false;
  const makeCollection = () => ({ createIndex: async () => {}, db: { command: async () => {
    if (failPing) throw new Error("mock Mongo outage");
    return { ok: 1 };
  } } });
  setMongoForTests({
    uri: "mongodb://mock.invalid/klyro",
    clientFactory: () => ({
      connect: async () => {},
      close: async () => {},
      db: () => ({ collection: makeCollection }),
    }),
  });
  assert.equal(await connectMongo(), true);
  const readyBefore = await jsonRequest("/health/ready");
  assert.equal(readyBefore.response.status, 200);

  failPing = true;
  const healthDuringOutage = await jsonRequest("/health");
  assert.equal(healthDuringOutage.body.database, "unavailable");
  assert.equal(healthDuringOutage.body.ready, false);
  const notReady = await jsonRequest("/health/ready");
  assert.equal(notReady.response.status, 503);

  failPing = false;
  assert.equal(await connectMongo(), true);
  const readyAfter = await jsonRequest("/health/ready");
  assert.equal(readyAfter.response.status, 200);
});

test("legacy review date index is upgraded when the server cannot alter TTL in place", async () => {
  const calls = [];
  const reviews = {
    collectionName: "reviews",
    listIndexes: () => ({ toArray: async () => [{ name: "date_-1", key: { date: -1 } }] }),
    db: { command: async (command) => {
      calls.push(["collMod", command]);
      const error = new Error("TTL index modification is unsupported");
      error.code = 72;
      throw error;
    } },
    dropIndex: async (name) => calls.push(["drop", name]),
    createIndex: async (key, options) => calls.push(["create", key, options]),
  };
  const makeCollection = (name) => name === "reviews" ? reviews : { createIndex: async () => {} };
  setMongoForTests({
    uri: "mongodb://mock.invalid/klyro",
    clientFactory: () => ({
      connect: async () => {},
      close: async () => {},
      db: () => ({ collection: makeCollection }),
    }),
  });

  assert.equal(await connectMongo(), true);
  assert.deepEqual(calls.map(([operation]) => operation), ["collMod", "drop", "create", "create"]);
  assert.deepEqual(calls[1], ["drop", "date_-1"]);
  assert.deepEqual(calls[2][1], { date: -1 });
  assert.ok(calls[2][2].expireAfterSeconds > 0);
});

test("MongoDB startup creates the reviews collection when it does not exist yet", async () => {
  const calls = [];
  const reviews = {
    collectionName: "reviews",
    listIndexes: () => ({ toArray: async () => {
      const error = new Error("ns does not exist: codesentinel.reviews");
      error.code = 26;
      error.codeName = "NamespaceNotFound";
      throw error;
    } }),
    createIndex: async (key, options) => calls.push([key, options]),
  };
  const makeCollection = (name) => name === "reviews" ? reviews : { createIndex: async () => {} };
  setMongoForTests({
    uri: "mongodb://mock.invalid/klyro",
    clientFactory: () => ({
      connect: async () => {},
      close: async () => {},
      db: () => ({ collection: makeCollection }),
    }),
  });

  assert.equal(await connectMongo(), true);
  assert.deepEqual(calls, [[{ date: -1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }], [{ userId: 1, date: -1 }, undefined]]);
});

test("API rate limits reject requests after the configured per-window allowance", async () => {
  let limited = false;
  for (let index = 0; index < 140 && !limited; index += 1) {
    const response = await fetch(`${baseUrl}/health/live`);
    limited = response.status === 429;
  }
  assert.equal(limited, true);
});
