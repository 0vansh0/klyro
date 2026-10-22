import { app, getPublicDeploymentDiagnostics, preparePublicDeployment } from "../server/server.js";

export default async function handler(req, res) {
  try {
    await preparePublicDeployment();
  } catch (error) {
    console.error("Public API is not ready:", error.message);
    const { blockers } = getPublicDeploymentDiagnostics();
    return res.status(503).json({
      error: blockers.length ? `The public API is not ready: ${blockers.join(" ")}` : "The public API is not ready. Check the Vercel function logs and database health.",
      blockers,
    });
  }

  const originalUrl = req.url || "/api";
  const incomingUrl = new URL(originalUrl, "https://klyro.invalid");
  const endpoint = incomingUrl.searchParams.get("path") || "";
  incomingUrl.searchParams.delete("path");
  const query = incomingUrl.searchParams.toString();
  req.url = `/api/${endpoint}${query ? `?${query}` : ""}`;
  return app(req, res);
}
