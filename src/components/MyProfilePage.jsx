import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Database,
  FileCode2,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Save,
  UserRound,
} from "lucide-react";
import AccountDeletionPanel from "./AccountDeletionPanel";

const integrationProviders = ["GitHub", "GitLab", "Jira"];

function localDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getReviewerLevel(findingCount) {
  if (findingCount >= 50) return { name: "Review Pro", next: null };
  if (findingCount >= 20) return { name: "Code Detective", next: 50 };
  if (findingCount >= 5) return { name: "Bug Scout", next: 20 };
  return { name: "Rookie Reviewer", next: 5 };
}

export default function MyProfilePage({
  apiBaseUrl = "/api",
  user,
  role,
  onRoleChange = () => {},
  reviewCount = 0,
  findingCount = 0,
  reviewHistory = [],
  databaseStatus = "checking",
  onUserUpdated = () => {},
  onNotify = () => {},
  onNavigate = () => {},
  onDeleted = () => {},
}) {
  const [name, setName] = useState(user?.name || "");
  const [savedRole, setSavedRole] = useState(role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef(null);
  const profileFormRef = useRef(null);
  const photoStorageKey = `klyro-profile-photo:${user?.id || "guest"}`;
  const [avatarUrl, setAvatarUrl] = useState(() => {
    try { return window.localStorage.getItem(photoStorageKey) || ""; } catch { return ""; }
  });

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && !event.repeat) {
        event.preventDefault();
        profileFormRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName || nextName.length > 48) {
      setError("Enter a display name between 1 and 48 characters.");
      return;
    }
    const roleChanged = role !== savedRole;
    if (nextName === user?.name && !roleChanged) {
      setError("");
      onNotify("Your profile is already up to date.");
      return;
    }

    if (nextName === user?.name) {
      setSavedRole(role);
      onNotify("Profile preferences saved.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: nextName }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update your profile.");
      onUserUpdated(result.user);
      setName(result.user.name);
      setSavedRole(role);
      onNotify("Profile updated successfully.");
    } catch (requestError) {
      setError(requestError.message || "Could not reach the account service.");
    } finally {
      setBusy(false);
    }
  }

  function changeAvatar(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setAvatarError("");
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setAvatarError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Choose an image smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      try {
        window.localStorage.setItem(photoStorageKey, reader.result);
        setAvatarUrl(reader.result);
        onNotify("Profile picture updated.");
      } catch {
        setAvatarError("Could not save this image in the browser. Try a smaller file.");
      }
    };
    reader.onerror = () => setAvatarError("Could not read this image. Try another file.");
    reader.readAsDataURL(file);
  }

  const initials = (user?.name?.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || "U").toUpperCase();
  const statusLabel = databaseStatus === "connected" ? "Connected" : databaseStatus === "checking" ? "Checking" : "Unavailable";
  const reviewerLevel = getReviewerLevel(findingCount);
  const activityCounts = new Map();
  for (const review of reviewHistory) {
    const date = new Date(review.date);
    if (Number.isNaN(date.getTime())) continue;
    const key = localDayKey(date);
    activityCounts.set(key, (activityCounts.get(key) || 0) + 1);
  }
  const today = new Date();
  const activityStart = new Date(today);
  activityStart.setHours(0, 0, 0, 0);
  activityStart.setDate(activityStart.getDate() - 29);
  const leadingCells = (activityStart.getDay() + 6) % 7;
  const activityDays = Array.from({ length: leadingCells }, (_, index) => ({ id: `blank-${index}`, blank: true }));
  for (let index = 0; index < 30; index += 1) {
    const date = new Date(activityStart);
    date.setDate(activityStart.getDate() + index);
    const key = localDayKey(date);
    const count = activityCounts.get(key) || 0;
    activityDays.push({ id: key, date, key, count, blank: false });
  }
  const activityTotal = activityDays.reduce((total, day) => total + (day.count || 0), 0);
  const levelStart = findingCount >= 50 ? 50 : findingCount >= 20 ? 20 : findingCount >= 5 ? 5 : 0;
  const levelSpan = reviewerLevel.next ? reviewerLevel.next - levelStart : 0;
  const levelProgress = reviewerLevel.next ? Math.min(100, Math.round(((findingCount - levelStart) / levelSpan) * 100)) : 100;
  const nextLevelName = findingCount < 5 ? "Bug Scout" : findingCount < 20 ? "Code Detective" : findingCount < 50 ? "Review Pro" : "";
  const nextLevelRemaining = reviewerLevel.next ? Math.max(0, reviewerLevel.next - findingCount) : 0;
  const reviewStyles = [
    { label: "Security", pattern: /security|inject|xss|auth|eval|secret|permission|crypto/i },
    { label: "Performance", pattern: /performance|complexity|slow|loop|memory|n\+1/i },
    { label: "Syntax", pattern: /syntax|parse|undef|unused|semicolon|format|eslint/i },
    { label: "Logic", pattern: /logic|condition|return|constant|bug|error|edge|correctness/i },
  ].map((category) => ({
    ...category,
    count: reviewHistory.reduce((total, review) => total + (review.findings || []).filter((item) => category.pattern.test(`${item.type || ""} ${item.title || ""} ${item.summary || ""} ${item.ruleId || ""}`)).length, 0),
  }));
  const maxStyleCount = Math.max(1, ...reviewStyles.map(({ count }) => count));
  const radarPoints = reviewStyles.map((category, index) => {
    const angle = ((index * 90) - 90) * Math.PI / 180;
    const radius = 48 * category.count / maxStyleCount;
    return `${60 + Math.cos(angle) * radius},${60 + Math.sin(angle) * radius}`;
  }).join(" ");
  const languageCounts = new Map();
  for (const review of reviewHistory) languageCounts.set(review.language || "Other", (languageCounts.get(review.language || "Other") || 0) + 1);
  const languageEntries = [...languageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const languageTotal = languageEntries.reduce((sum, [, count]) => sum + count, 0);
  const languageColors = ["#71a5f7", "#8c79e8", "#53c59a", "#e7ac61", "#e47f9a"];
  let languageAngle = 0;
  const languageGradient = languageTotal ? languageEntries.map(([, count], index) => {
    const start = languageAngle;
    languageAngle += count / languageTotal * 360;
    return `${languageColors[index]} ${start}deg ${languageAngle}deg`;
  }).join(", ") : "#323b49 0deg 360deg";
  const recentActivity = [...reviewHistory].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  return (
    <main className="dashboard-content page-content">
      <div className="my-profile-page">
        <div className="my-profile-page-heading">
          <div><h1>My Profile</h1><p>Manage your account and developer workspace.</p></div>
          <span className="reviewer-level-badge"><KeyRound size={14} /> {reviewerLevel.name}</span>
        </div>

        <div className="my-profile-grid">
          <div className="my-profile-primary-column">
          <section className="settings-card my-profile-details">
            <div className="my-profile-details-heading">
              <div className="profile-avatar-wrap">
                <div className="my-profile-avatar" aria-label={avatarUrl ? "Custom profile picture" : `${initials} profile avatar`}>
                  {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
                </div>
                <button type="button" className="profile-avatar-edit" onClick={() => avatarInputRef.current?.click()} aria-label="Change profile picture" title="Change profile picture"><Camera size={14} /></button>
                <input ref={avatarInputRef} className="profile-avatar-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={changeAvatar} />
              </div>
              <div className="my-profile-details-title"><h2>Personal details</h2><p>Update your account name and workspace role.</p></div>
            </div>
            {avatarError && <p className="my-profile-error" role="alert">{avatarError}</p>}
            <form ref={profileFormRef} className="my-profile-form" onSubmit={saveProfile}>
              <label className="settings-field profile-field">
                <span>Display name</span>
                <input autoComplete="name" maxLength={48} value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <label className="settings-field profile-field">
                <span className="profile-field-label"><span>Email address</span><small><LockKeyhole size={12} /> Sign-in address</small></span>
                <span className="profile-email-value"><LockKeyhole size={14} /><span>{user?.email || ""}</span></span>
              </label>
              <label className="settings-field profile-field">
                <span>Your role</span>
                <select value={role} onChange={(event) => onRoleChange(event.target.value)}>
                  {["Student", "Developer", "Reviewer", "Team lead", "Other"].map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              {error && <p className="my-profile-error" role="alert">{error}</p>}
              <div className="my-profile-save-row">
                <button type="submit" className={`primary-button my-profile-save ${name.trim() !== user?.name || role !== savedRole ? "has-changes" : ""}`} disabled={busy || !name.trim() || (name.trim() === user?.name && role === savedRole)}>
                  <Save size={15} /> {busy ? "Saving…" : "Save profile"}
                </button>
                <span className="profile-shortcut"><kbd>Ctrl</kbd><span>/</span><kbd>⌘</kbd><span>+</span><kbd>S</kbd><small>to save</small></span>
              </div>
            </form>
          </section>

          <section className="settings-card profile-insights-card">
            <div className="settings-card-heading"><h2>Review insights</h2><p>Based on findings and languages in your saved reviews.</p></div>
            <div className="profile-insight-grid">
              <div className="profile-insight-chart"><h3>Review style</h3><svg className="profile-radar-chart" viewBox="0 0 120 120" role="img" aria-label={`Review style: ${reviewStyles.map((item) => `${item.label} ${item.count}`).join(", ")}`}><polygon points="60,12 108,60 60,108 12,60" className="radar-grid" /><polygon points="60,24 96,60 60,96 24,60" className="radar-grid inner" /><line x1="60" y1="12" x2="60" y2="108" /><line x1="12" y1="60" x2="108" y2="60" /><polygon points={radarPoints} className="radar-data" /></svg><div className="radar-labels">{reviewStyles.map((item) => <span key={item.label}>{item.label} <b>{item.count}</b></span>)}</div></div>
              <div className="profile-insight-chart"><h3>Languages reviewed</h3><div className="profile-language-donut" role="img" aria-label={languageTotal ? `${languageEntries.map(([languageName, count]) => `${languageName}: ${count}`).join(", ")} saved reviews` : "No saved review language data yet"} style={{ background: `conic-gradient(${languageGradient})` }}><span>{languageTotal}<small>reviews</small></span></div><div className="profile-language-legend">{languageEntries.length ? languageEntries.map(([languageName, count], index) => <span key={languageName}><i style={{ background: languageColors[index] }} />{languageName}<b>{count}</b></span>) : <small>No saved reviews yet</small>}</div></div>
            </div>
          </section>

          <section className="settings-card profile-timeline-card">
            <div className="settings-card-heading"><h2>Recent activity</h2><p>Your latest saved reviews and achievements.</p></div>
            {recentActivity.length ? <ol className="profile-activity-timeline">{recentActivity.map((review) => <li key={review.id}><i /><div><strong>Reviewed {review.fileName || review.language || "code"}</strong><span>{review.language || "Code review"} · {review.issueCount ?? (review.findings || []).length} findings</span><small>{new Date(review.date).toLocaleString()}</small></div></li>)}{findingCount >= 5 && <li><i className="badge-timeline-dot" /><div><strong>{reviewerLevel.name} badge earned</strong><span>Milestone reached: {findingCount} findings reviewed</span></div></li>}</ol> : <div className="profile-empty-state timeline-empty"><span><GitBranch size={16} /></span><strong>No activity yet</strong><p>Saved code reviews and reviewer badges will appear here.</p></div>}
          </section>
          </div>

          <div className="my-profile-side">
            <section className="settings-card my-profile-stats">
              <div className="settings-card-heading"><h2>Workspace activity</h2><p>Code reviews completed during the last 30 days.</p></div>
              <div className="activity-summary"><strong>{activityTotal}</strong><span>reviews in the last 30 days</span><small>{findingCount} findings across {reviewCount} saved reviews</small></div>
              <div className="activity-heatmap" role="img" aria-label={`${activityTotal} code reviews in the last 30 days`}>
                {activityDays.map((day) => day.blank
                  ? <span key={day.id} className="activity-cell blank" aria-hidden="true" />
                  : <span key={day.id} className={`activity-cell level-${day.count === 0 ? 0 : day.count === 1 ? 1 : day.count <= 3 ? 2 : 3}`} title={`${day.date.toLocaleDateString()}: ${day.count} review${day.count === 1 ? "" : "s"}`} />)}
              </div>
              <div className="activity-heatmap-legend"><span>Less</span><i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" /><span>More</span></div>
              <div className="reviewer-level-progress"><div><span>Reviewer level</span><strong>{reviewerLevel.name}</strong></div><div className="reviewer-level-track" role="progressbar" aria-label="Progress toward next reviewer badge" aria-valuemin="0" aria-valuemax="100" aria-valuenow={levelProgress}><i style={{ width: `${levelProgress}%` }} /></div><small>{reviewerLevel.next ? `${nextLevelRemaining} more ${nextLevelRemaining === 1 ? "finding" : "findings"} to ${nextLevelName}` : "Top badge unlocked"}</small></div>
              <div className={`my-profile-database ${databaseStatus}`}><Database size={15} /><span>MongoDB</span><strong><i className={`profile-status-dot ${databaseStatus === "connected" ? "online" : ""}`} />{statusLabel}</strong></div>
            </section>

            <section className="settings-card my-profile-links">
              <div className="settings-card-heading"><h2>Shortcuts</h2><p>Continue where you left off.</p></div>
              <button type="button" onClick={() => onNavigate("My Reviews")}><FileCode2 size={15} /> My Reviews <ArrowRight size={15} /></button>
              <button type="button" onClick={() => onNavigate("Learning Hub")}><BookOpen size={15} /> Learning Hub <ArrowRight size={15} /></button>
              <button type="button" onClick={() => onNavigate("Settings")}><UserRound size={15} /> Workspace settings <ArrowRight size={15} /></button>
            </section>

            <section className="settings-card my-profile-integrations">
              <div className="settings-card-heading"><h2>Developer integrations</h2><p>Connect your tools when OAuth is configured for this workspace.</p></div>
              {integrationProviders.map((provider) => <div className="integration-row" key={provider}><span className="integration-provider-icon"><GitBranch size={15} /></span><strong>{provider}</strong><span className="integration-status">Not connected</span><button type="button" disabled title={`${provider} OAuth setup is not configured`}>Setup needed</button></div>)}
              <small className="integration-note">Provider connections need OAuth app credentials and secure server callbacks; they are not configured yet.</small>
            </section>

            <section className="settings-card profile-pending-card">
              <div className="settings-card-heading"><h2>Awaiting Your Review</h2><p>Items assigned to you for review.</p></div>
              <div className="profile-empty-state"><span><FileCode2 size={17} /></span><strong>No assigned reviews yet</strong><p>Connect a repository provider in Settings or start a code review directly.</p><button type="button" onClick={() => onNavigate("New Review")}>Start a review <ArrowRight size={13} /></button></div>
            </section>

          </div>
        </div>

        <AccountDeletionPanel apiBaseUrl={apiBaseUrl} user={user} onDeleted={onDeleted} />
      </div>
    </main>
  );
}
