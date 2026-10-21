import { useState } from "react";

export default function AccountDeletionPanel({ apiBaseUrl = "/api", user, onDeleted = () => {}, onLogin = () => {} }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function deleteAccount(event) {
    event.preventDefault();
    if (!window.confirm("Permanently delete your account, saved reviews, and sessions? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/auth/account`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not delete your account.");
      setPassword("");
      onDeleted();
    } catch (requestError) {
      setError(requestError.message || "Could not reach the account service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-card account-danger-card">
      <div className="settings-card-heading">
        <h2>Account deletion</h2>
        <p>{user ? `Signed in as ${user.email}. Deleting your account also removes its saved reviews and sessions.` : "Sign in to permanently delete your account and saved reviews."}</p>
      </div>
      {user ? (
        <form className="account-delete-form" onSubmit={deleteAccount}>
          <label className="settings-field">
            <span>Confirm your password</span>
            <input autoComplete="current-password" type="password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="account-delete-error" role="alert">{error}</p>}
          <button className="account-delete-button" type="submit" disabled={busy}>
            {busy ? "Deleting account…" : "Permanently delete account"}
          </button>
        </form>
      ) : (
        <button className="account-delete-button" type="button" onClick={onLogin}>Sign in to manage your account</button>
      )}
    </section>
  );
}
