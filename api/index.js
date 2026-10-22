import { app, preparePublicDeployment } from "../server/server.js";

export default async function handler(req, res) {
  try {
    await preparePublicDeployment();
  } catch (error) {
    console.error("Public API is not ready:", error.message);
    return res.status(503).json({ error: "The public API is not configured or ready. Check deployment configuration and database health." });
  }

  const originalUrl = req.url || "/api";
  const incomingUrl = new URL(originalUrl, "https://klyro.invalid");
  const endpoint = incomingUrl.searchParams.get("path") || "";
  incomingUrl.searchParams.delete("path");
  const query = incomingUrl.searchParams.toString();
  req.url = `/api/${endpoint}${query ? `?${query}` : ""}`;
  return app(req, res);
}
