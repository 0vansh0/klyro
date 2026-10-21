import process from "node:process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const dotenv = require("../server/node_modules/dotenv");
const { MongoClient } = require("../server/node_modules/mongodb");
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, "server", ".env") });
const apiBaseUrl = (process.env.CODE_SENTINEL_API_URL || "http://127.0.0.1:5000/api").replace(/\/$/, "");
let reviewId = null;
let sessionCookie = null;
let accountCreated = false;
let accountPassword = null;
let verifierClient = null;

async function request(path, options) {
  const headers = new Headers(options?.headers || {});
  if (sessionCookie) headers.set("Cookie", sessionCookie);
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const setCookie = response.headers.getSetCookie?.()[0] || response.headers.get("set-cookie");
  if (setCookie && path === "/auth/register") sessionCookie = setCookie.split(";", 1)[0];
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

try {
  const health = await request("/health");
  if (health.database !== "connected") {
    throw new Error(`MongoDB is ${health.database || "unavailable"}. Configure MONGODB_URI before checking persistence.`);
  }

  verifierClient = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 6000 });
  await verifierClient.connect();
  const database = verifierClient.db(process.env.MONGODB_DB || "codesentinel");
  const reviewIndexes = await database.collection("reviews").listIndexes().toArray();
  const retentionSeconds = Number.parseInt(process.env.REVIEW_RETENTION_DAYS || "30", 10) * 24 * 60 * 60;
  const retentionIndex = reviewIndexes.find((index) => Object.keys(index.key ?? {}).length === 1 && index.key.date);
  if (retentionIndex?.expireAfterSeconds !== retentionSeconds) {
    throw new Error(`MongoDB review TTL index is missing or incorrect (expected ${retentionSeconds} seconds). Restart the API so its index migration can run, then retry.`);
  }

  accountPassword = `Probe-${randomUUID()}-aA1!`;
  const account = await request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "KLYRO persistence probe",
      email: `mongo-probe-${randomUUID()}@example.invalid`,
      password: accountPassword,
    }),
  });
  accountCreated = Boolean(account.authenticated && account.user?.id);
  if (!accountCreated || !sessionCookie) throw new Error("Could not establish a temporary signed-in account for the persistence check.");

  const result = await request("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: "function mongoPersistenceProbe() { return true; }",
      language: "JavaScript",
      mode: "static",
      fileName: "mongo-persistence-check.js",
    }),
  });

  reviewId = result.reviewId;
  if (!result.persisted || !reviewId) {
    throw new Error("The API completed analysis but did not confirm a MongoDB save. Check MONGODB_URI and the backend health endpoint.");
  }

  const history = await request("/reviews");
  if (!history.reviews?.some((review) => review.id === reviewId)) {
    throw new Error("The review was saved, but it could not be read back from MongoDB.");
  }

  await request(`/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
  reviewId = null;
  console.log("MongoDB persistence verified: account and review saved, review read back, and cleanup completed.");
} catch (error) {
  console.error(`MongoDB persistence check failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (reviewId) {
    try {
      await request(`/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
    } catch {
      console.error("Could not clean up the persistence probe review; remove it from My Reviews if needed.");
    }
  }
  if (accountCreated) {
    try {
      await request("/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: accountPassword }),
      });
    } catch {
      console.error("Could not clean up the temporary account; remove its mongo-probe email from the users collection.");
    }
  }
  await verifierClient?.close().catch(() => {});
}
