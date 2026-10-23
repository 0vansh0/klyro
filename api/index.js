import { app, getPublicDeploymentDiagnostics, preparePublicDeployment } from "../server/server.js";

export default async function handler(req, res) {
  const originalUrl = req.url || "/api";
  const incomingUrl = new URL(originalUrl, "https://klyro.invalid");
  const endpoint = incomingUrl.searchParams.get("path") || "";
  if (req.method === "GET" && endpoint === "health/ready") {
    await preparePublicDeployment().catch(() => {});
    const diagnostics = getPublicDeploymentDiagnostics();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(diagnostics.ready ? 200 : 503).json({
      status: diagnostics.ready ? "ready" : "not_ready",
      service: "KLYRO API",
      ...diagnostics,
    });
  }

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

  incomingUrl.searchParams.delete("path");
  const query = incomingUrl.searchParams.toString();
  req.url = `/api/${endpoint}${query ? `?${query}` : ""}`;
  return app(req, res);
}
