import { useEffect, useState } from "react";
import { ArrowRight, LoaderCircle, X } from "lucide-react";

const API_PATHS = {
  login: "login",
  register: "register",
  forgot: "password/forgot",
  reset: "password/reset",
  verify: "verify-email",
};

export default function AuthDialog({ apiBaseUrl = "/api", initialName = "", initialAction = "", actionToken = "", onClose = () => {}, onSuccess = () => {} }) {
  const [mode, setMode] = useState(["verify", "reset"].includes(initialAction) ? initialAction : "login");
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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

  useEffect(() => {
    if (initialAction !== "verify" || !actionToken) return;
    let active = true;
    setBusy(true);
    fetch(`${apiBaseUrl}/auth/${API_PATHS.verify}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token: actionToken }),
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "This verification link is invalid or expired.");
      if (active) onSuccess(result.user);
    }).catch((requestError) => {
      if (active) setError(requestError instanceof TypeError ? "Could not reach the account service. Try again shortly." : requestError.message);
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [actionToken, apiBaseUrl, initialAction, onSuccess]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (mode === "register" && password !== confirmPassword) return setError("The passwords do not match.");
    if (mode === "reset" && password !== confirmPassword) return setError("The passwords do not match.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = mode === "login" ? { email, password }
        : mode === "register" ? { name, email, password }
          : mode === "forgot" ? { email }
            : { token: actionToken, password };
      const response = await fetch(`${apiBaseUrl}/auth/${API_PATHS[mode]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const contentType = response.headers.get("content-type") || "";
      const result = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
      if (!response.ok) throw new Error(result.error || (response.status >= 500
        ? "The account service is temporarily unavailable. Please try again shortly."
        : `Account request failed (HTTP ${response.status}). Please try again.`));

      if (mode === "login") return onSuccess(result.user);
      if (mode === "register") {
        if (result.verificationRequired) {
          setMode("login");
          setNotice("Account created. Check your email for a verification link before signing in.");
          return;
        }
        return onSuccess(result.user);
      }
      if (mode === "forgot") {
        setNotice(result.message || "If an account exists for this address, a password reset link has been sent.");
        return;
      }
      if (mode === "reset") {
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setNotice(result.message || "Password updated. Sign in with your new password.");
      }
    } catch (requestError) {
      setError(requestError instanceof TypeError
        ? "Could not reach the account service. Check your connection, then try again."
        : requestError.message || "Could not reach the account service.");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (!email) return setError("Enter your email address first.");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/auth/verification/resend`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not request a verification link.");
      setNotice(result.message || "If this account needs verification, a new link has been sent.");
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Could not reach the account service. Try again shortly." : requestError.message);
    } finally { setBusy(false); }
  }

  const title = mode === "login" ? "Welcome back" : mode === "register" ? "Create your account"
    : mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : "Verify your email";
  const description = mode === "login" ? "Sign in to save and access your private review history."
    : mode === "register" ? "Create an account to keep your reviews in your own workspace."
      : mode === "forgot" ? "We’ll email a reset link if an account exists for this address."
        : mode === "reset" ? "Choose a new password for your KLYRO account."
          : "Checking your email verification link…";

  return (
    <div className="auth-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" onClick={onClose} disabled={busy} aria-label="Close account dialog"><X size={18} /></button>
        <span className="auth-mark"><img src="/KLYRO_LOGO.png" alt="KLYRO logo" /></span>
        <p className="auth-eyebrow">KLYRO ACCOUNT</p>
        <h2 id="auth-title">{title}</h2>
        <p className="auth-description">{description}</p>
        {mode !== "verify" && <form onSubmit={handleSubmit}>
          {mode === "register" && <label><span>Your name</span><input autoComplete="name" required maxLength={48} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>}
          {mode !== "reset" && <label><span>Email address</span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>}
          {!["forgot"].includes(mode) && <label><span>{mode === "reset" ? "New password" : "Password"}</span><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>}
          {["register", "reset"].includes(mode) && <label><span>Confirm password</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="auth-spinner" size={16} /> : null}
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>}
        {mode === "verify" && <>
          {busy && <p role="status">Verifying…</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {error && <button type="button" className="auth-link-button" onClick={() => { setMode("login"); setError(""); }}>Back to sign in</button>}
        </>}
        {mode === "login" && <div className="auth-secondary-actions"><button type="button" className="auth-link-button" disabled={busy} onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}>Forgot password?</button><button type="button" className="auth-link-button" disabled={busy} onClick={resendVerification}>Resend verification email</button></div>}
        {mode !== "verify" && mode !== "reset" && <p className="auth-switch">{mode === "login" ? "New to KLYRO?" : "Already have an account?"}<button type="button" disabled={busy} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setNotice(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>}
        <p className="auth-storage-note" role="status">{serviceStatus === "connected" ? "Account storage is connected." : serviceStatus === "checking" ? "Checking account service…" : serviceStatus === "offline" ? "Account service is offline. Start KLYRO with npm run dev." : serviceStatus === "browser_only" || serviceStatus === "not_configured" ? "Account storage is not configured on this server." : "Account database is temporarily unavailable. Check the server connection and try again."}</p>
      </section>
    </div>
  );
}
