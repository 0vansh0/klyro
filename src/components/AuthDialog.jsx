import { useEffect, useState } from "react";
import { ArrowRight, LoaderCircle, X } from "lucide-react";

export default function AuthDialog({ apiBaseUrl = "/api", initialName = "", onClose = () => {}, onSuccess = () => {} }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [serviceStatus, setServiceStatus] = useState("checking");

  useEffect(() => {
    let active = true;
    const checkService = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/health`, { credentials: "same-origin" });
        const health = await response.json().catch(() => ({}));
        if (!response.ok || health.service !== "KLYRO API") throw new Error("offline");
        if (active) setServiceStatus(health.database || "unavailable");
      } catch {
        if (active) setServiceStatus("offline");
      }
    };
    void checkService();
    const timer = window.setInterval(checkService, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [apiBaseUrl]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (mode === "register" && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(mode === "login" ? { email, password } : { name, email, password }),
      });
      const contentType = response.headers.get("content-type") || "";
      const result = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
      if (!response.ok) {
        const message = result.error || (response.status === 502 || response.status === 503 || response.status === 504
          ? "The account service or its database is temporarily unavailable. The app will keep trying to restore the server; wait a moment and try again."
          : `Account request failed (HTTP ${response.status}). Please try again.`);
        throw new Error(message);
      }
      onSuccess(result.user);
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "Could not reach the account service. Check that KLYRO is running with npm run dev, then try again."
        : requestError.message || "Could not reach the account service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" onClick={onClose} disabled={busy} aria-label="Close sign-in dialog"><X size={18} /></button>
        <span className="auth-mark"><img src="/KLYRO_LOGO.png" alt="KLYRO logo" /></span>
        <p className="auth-eyebrow">KLYRO ACCOUNT</p>
        <h2 id="auth-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="auth-description">{mode === "login" ? "Sign in to save and access your private review history." : "Create an account to keep your reviews in your own workspace."}</p>
        <form onSubmit={handleSubmit}>
          {mode === "register" && <label><span>Your name</span><input autoComplete="name" required maxLength={48} value={name} onChange={(event) => setName(event.target.value)} placeholder="Vansh Raj" /></label>}
          <label><span>Email address</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label><span>Password</span><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
          {mode === "register" && <label><span>Confirm password</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="auth-spinner" size={16} /> : null}
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>
        <p className="auth-switch">{mode === "login" ? "New to KLYRO?" : "Already have an account?"}<button type="button" disabled={busy} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>
        <p className="auth-storage-note" role="status">{serviceStatus === "connected" ? "Account storage is connected." : serviceStatus === "checking" ? "Checking account service…" : serviceStatus === "offline" ? "Account service is offline. Start KLYRO with npm run dev." : serviceStatus === "browser_only" || serviceStatus === "not_configured" ? "Account storage is not configured on this server." : "Account database is temporarily unavailable. Check the server connection and try again."}</p>
      </section>
    </div>
  );
}
