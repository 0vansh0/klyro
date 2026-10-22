import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Database,
  PanelLeftOpen,
  FileCode2,
  History,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  SlidersHorizontal,
  Bell,
  GitBranch,
  Save,
} from "lucide-react";
import { siGithub } from "simple-icons";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import CodeEditor from "./components/CodeEditor";
import FindingsPanel from "./components/FindingsPanel";
import LearningHub from "./components/LearningHub";
import AuthDialog from "./components/AuthDialog";
import MyProfilePage from "./components/MyProfilePage";
import { EDITOR_LANGUAGES, LANGUAGE_CATEGORIES, LANGUAGE_PROFILES, getLanguageProfile } from "./languages";

// Account cookies use same-origin credentials. Keep browser API traffic on the
// Vite /api proxy unless credentialed CORS and CSRF protections are added.
const API_BASE_URL = "/api";
// Keep the request mode aligned with the analyzer that handles JavaScript.
// The API continues to accept "static" as a legacy alias.
const ANALYSIS_MODE = "eslint";
const STORAGE_KEYS = {
  history: "codesentinel.reviewHistory",
  appearance: "codesentinel.appearance",
  language: "codesentinel.editorLanguage",
  strictness: "klyro.reviewStrictness",
  keymap: "klyro.editorKeymap",
  notifications: "klyro.notificationPreferences",
  rules: "klyro.customLintRules",
};
const DEFAULT_NOTIFICATIONS = { reviewComplete: true, systemUpdates: true, mentions: true };

function readStoredValue(key, fallback, isValid = () => true) {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return fallback;
    const value = JSON.parse(stored);
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredValue(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be disabled or full; the in-memory app state still works.
  }
}

const STARTER_CODE = `function greetUser(user) {
  return "Hello, " + user.name.toUpperCase();
}

function calculateAverage(numbers) {
  const total = numbers.reduce((sum, n) => sum + n, 0);
  return total / numbers.length;
}

export { greetUser, calculateAverage };`;

function normalizeESLintFinding(item, index) {
  const rawSeverity = String(item.severity ?? "").toLowerCase();
  const severity = rawSeverity === "2" || rawSeverity === "error" || rawSeverity === "fatal"
    ? "High"
    : rawSeverity === "1" || rawSeverity === "warning" ? "Medium" : "Low";

  return {
    id: item.id ?? index + 1,
    title: item.message || item.ruleId || "Code issue detected",
    severity,
    line: item.line || item.lineNumber || item.loc?.start?.line || 1,
    column: item.column || item.columnNumber || item.loc?.start?.column || 1,
    type: item.ruleId || "Static analysis",
    source: item.source || "Static analysis",
    summary: item.message || "Review this finding.",
    explanation: item.message || "The static analyzer reported a possible issue. Review the surrounding code.",
    evidence: item.ruleId ? `Rule: ${item.ruleId}` : "Reported by the static analyzer.",
    fix: item.fix || null,
    status: "Needs review",
  };
}

function getFindingsFromResponse(data) {
  const responseData = data ?? {};
  const rawFindings = Array.isArray(responseData)
    ? responseData
    : responseData.findings ?? responseData.results ?? responseData.issues ?? responseData.messages ?? [];

  if (!Array.isArray(rawFindings)) {
    throw new Error("The analyzer returned an unexpected response format.");
  }

  if (rawFindings.length === 0) {
    return [{
      id: 1,
      title: "No issues reported",
      severity: "Low",
      line: 1,
      type: "Clean result",
      source: responseData.engine || "Static analysis",
      summary: "The analyzer did not report any issues.",
      explanation: "No findings were returned for this scan. This is not a guarantee that the code is completely bug-free.",
      evidence: "The analyzer returned zero findings.",
      fix: null,
      status: "Informational",
    }];
  }

  return rawFindings.map(normalizeESLintFinding);
}

function getIssueCount(items) {
  return items.filter(
    (item) => item.type !== "Clean result" && item.type !== "Information" && item.type !== "Clean"
  ).length;
}

export default function App() {
  const [code, setCode] = useState(STARTER_CODE);
  const [findings, setFindings] = useState([]);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [currentFile, setCurrentFile] = useState({ id: "source.js", name: "source.js" });
  const [editorKey, setEditorKey] = useState(0);
  const [draftDirty, setDraftDirty] = useState(false);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [hoveredFinding, setHoveredFinding] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const [activePage, setActivePage] = useState("Dashboard");
  const [language, setLanguage] = useState(() =>
    readStoredValue(STORAGE_KEYS.language, "JavaScript", (value) => EDITOR_LANGUAGES.includes(value))
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [actionResult, setActionResult] = useState(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [lastReviewDate, setLastReviewDate] = useState(null);
  const analysisRequestRef = useRef(0);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [databaseStatus, setDatabaseStatus] = useState("checking");
  const [profile, setProfile] = useState({ name: "Guest", role: "Student" });
  const [authUser, setAuthUser] = useState(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authAction, setAuthAction] = useState("");
  const [authActionToken, setAuthActionToken] = useState("");

  const [toast, setToast] = useState("");
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [findingsVisible, setFindingsVisible] = useState(true);
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [analyzerSearch, setAnalyzerSearch] = useState("");
  const [analyzerCategory, setAnalyzerCategory] = useState("Popular");
  const [appearance, setAppearance] = useState(() =>
    readStoredValue("codesentinel.appearance", "dark", (value) => value === "dark" || value === "light")
  );
  const [strictness, setStrictness] = useState(() => readStoredValue(STORAGE_KEYS.strictness, "standard", (value) => ["lenient", "standard", "strict", "security"].includes(value)));
  const [keymap, setKeymap] = useState(() => readStoredValue(STORAGE_KEYS.keymap, "vscode", (value) => ["vscode", "vim", "emacs"].includes(value)));
  const [notificationPreferences, setNotificationPreferences] = useState(() => readStoredValue(STORAGE_KEYS.notifications, DEFAULT_NOTIFICATIONS, (value) => value && typeof value === "object"));
  const [customRules, setCustomRules] = useState(() => readStoredValue(STORAGE_KEYS.rules, {}, (value) => value && typeof value === "object" && !Array.isArray(value)));
  const [settingsName, setSettingsName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    try { window.localStorage.removeItem(STORAGE_KEYS.history); } catch { /* Code history is account-only; cleanup is best effort. */ }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const verifyToken = url.searchParams.get("verifyEmail");
    const resetToken = url.searchParams.get("resetPassword");
    if (!verifyToken && !resetToken) return;
    const token = verifyToken || resetToken;
    const action = verifyToken ? "verify" : "reset";
    url.searchParams.delete("verifyEmail");
    url.searchParams.delete("resetPassword");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    setAuthAction(action);
    setAuthActionToken(token);
    setAuthDialogOpen(true);
  }, []);
  useEffect(() => writeStoredValue(STORAGE_KEYS.appearance, appearance), [appearance]);
  useEffect(() => writeStoredValue(STORAGE_KEYS.language, language), [language]);
  useEffect(() => {
    try { window.localStorage.removeItem("codesentinel.profile"); } catch { /* Remove older cached personal details when possible. */ }
  }, []);
  useEffect(() => writeStoredValue(STORAGE_KEYS.strictness, strictness), [strictness]);
  useEffect(() => writeStoredValue(STORAGE_KEYS.keymap, keymap), [keymap]);
  useEffect(() => writeStoredValue(STORAGE_KEYS.notifications, notificationPreferences), [notificationPreferences]);
  useEffect(() => writeStoredValue(STORAGE_KEYS.rules, customRules), [customRules]);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/health`)
      .then((response) => {
        if (!response.ok) throw new Error("API health check failed.");
        return response.json();
      })
      .then((data) => {
        if (active) setDatabaseStatus(data.database || "not_configured");
      })
      .catch(() => {
        if (active) setDatabaseStatus("unavailable");
      });

    fetch(`${API_BASE_URL}/auth/me`, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (active && data?.authenticated && data.user) {
          setAuthUser(data.user);
          setProfile((current) => ({ ...current, name: data.user.name }));
        }
      })
      .catch(() => {
        // Keep the local guest profile when account services are unavailable.
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authUser) return;
    let active = true;
    fetch(`${API_BASE_URL}/reviews`, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load account review history.");
        return response.json();
      })
      .then((data) => { if (active && Array.isArray(data.reviews)) setReviewHistory(data.reviews); })
      .catch(() => { if (active) window.__klyroToast?.("Signed in, but account review history could not be loaded."); });
    return () => { active = false; };
  }, [authUser]);

  const toastTimerRef = useRef(null);
  const copyTimerRef = useRef(null);
  const notificationPreferencesRef = useRef(notificationPreferences);

  const notify = useCallback((message) => {
    const text = String(message).toLowerCase();
    const preference = text.includes("review completed") || text.includes("review complete")
      ? "reviewComplete"
      : text.includes("mention") ? "mentions" : "systemUpdates";
    if (notificationPreferencesRef.current[preference] === false) return;
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
      toastTimerRef.current = null;
    }, 2800);
  }, []);
  useEffect(() => { notificationPreferencesRef.current = notificationPreferences; }, [notificationPreferences]);

  useEffect(() => {
    window.__klyroToast = notify;
    return () => {
      if (window.__klyroToast === notify) delete window.__klyroToast;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, [notify]);

  const navigate = useCallback((page, options = {}) => {
    if (page === "My Profile" && !authUser) {
      setAuthDialogOpen(true);
      return;
    }
    if (page === "New Review" && draftDirty) {
      const confirmed = window.confirm("Start a new review and discard the unsaved code in this workspace?");
      if (!confirmed) return;
    }

    analysisRequestRef.current += 1;
    if (page === "Settings") setSettingsName(authUser?.name || profile.name);
    setActivePage(page);
    setHoveredFinding(null);
    setSeverityFilter("all");

    if (page === "New Review") {
      const nextLanguage = EDITOR_LANGUAGES.includes(options.language) ? options.language : language;
      const profile = getLanguageProfile(nextLanguage);
      const extension = profile.extension;
      setLanguage(nextLanguage);
      setCode(profile.starter);
      setFindings([]);
      setCurrentFile({ id: `source.${extension}`, name: `source.${extension}` });
      setEditorKey((key) => key + 1);
      setDraftDirty(false);
      setSelectedFinding(null);
      setAnalysisComplete(false);
      setLastReviewDate(null);
    }
  }, [authUser, draftDirty, language, profile.name]);

  const finishSignIn = useCallback((user) => {
    setAuthUser(user);
    setReviewHistory([]);
    setProfile((current) => ({ ...current, name: user.name }));
    setAuthDialogOpen(false);
    setActivePage("My Profile");
    notify(`Signed in as ${user.email}.`);
  }, [notify]);

  const signOut = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "same-origin" });
    } catch {
      // Clear the local account state even when the API has gone offline.
    } finally {
      setAuthUser(null);
      setReviewHistory([]);
      setProfile({ name: "Guest", role: "Student" });
      setSettingsName("Guest workspace");
      setActivePage("Dashboard");
      notify("You have signed out.");
    }
  }, [notify]);

  const accountDeleted = useCallback(() => {
    setAuthUser(null);
    setReviewHistory([]);
    setProfile({ name: "Guest", role: "Student" });
    setSettingsName("Guest workspace");
    setActivePage("Dashboard");
    notify("Your account and saved server reviews have been deleted.");
  }, [notify]);

  const runReview = useCallback(async () => {
    if (!code.trim()) {
      notify("Paste some code before starting a review.");
      return;
    }

    const requestId = ++analysisRequestRef.current;
    const reviewedFile = currentFile;
    setIsAnalyzing(true);
    setAnalysisComplete(false);

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          mode: ANALYSIS_MODE,
          fileId: currentFile.id,
          fileName: currentFile.name,
          strictness,
          customRules,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || `Analysis failed (${response.status}).`);
      const results = getFindingsFromResponse(data);

      if (analysisRequestRef.current !== requestId) return;

      const reviewDate = new Date();
      const reviewId = data.reviewId || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const associatedResults = results.map((finding) => ({
        ...finding,
        reviewId,
        fileId: reviewedFile.id,
        fileName: reviewedFile.name,
      }));

      setFindings(associatedResults);
      setSelectedFinding(associatedResults[0]?.id ?? null);
      setHoveredFinding(null);
      setAnalysisComplete(true);
      setLastReviewDate(reviewDate);
      setDraftDirty(false);
      if (data.persisted) setDatabaseStatus("connected");
      else if (data.persistenceStatus === "failed") setDatabaseStatus("unavailable");
      else if (data.persistenceStatus !== "sign_in_required") setDatabaseStatus(data.persistenceStatus || "not_configured");

      if (authUser && data.persisted) {
        const historyItem = {
          id: reviewId,
          date: reviewDate.toISOString(),
          code,
          language,
          fileId: reviewedFile.id,
          fileName: reviewedFile.name,
          mode: data.mode || ANALYSIS_MODE,
          engine: data.engine || "Static analysis",
          persisted: true,
          findings: associatedResults,
          issueCount: getIssueCount(associatedResults),
        };
        setReviewHistory((previous) => [historyItem, ...previous]);
      }
      setActivePage("New Review");

      notify(data.persisted
        ? `${data.engine || "Code"} review completed and saved to MongoDB.`
        : data.persistenceStatus === "sign_in_required"
          ? `${data.engine || "Code"} review completed. Sign in to save code and findings to your review history.`
          : `${data.engine || "Code"} review completed, but account history could not be saved. Check MongoDB and try again.`);
    } catch (error) {
      if (analysisRequestRef.current !== requestId) return;
      notify(error instanceof TypeError
        ? "Could not reach the analysis server. Start the app with npm run dev and try again."
        : error.message || "Could not analyze the code. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [authUser, code, currentFile, language, notify, strictness, customRules]);

  const correctCode = useCallback(async () => {
    if (!code.trim()) {
      notify("Paste some code before asking for corrections.");
      return;
    }

    const requestId = ++analysisRequestRef.current;
    setIsAnalyzing(true);
    setIsCorrecting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/repair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, fileName: currentFile.name, findings }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || `Repair failed (${response.status}).`);
      if (analysisRequestRef.current !== requestId) return;
      setActionResult({ type: "repair", title: "Review suggested correction", text: data.summary, source: code, corrected: data.correctedCode });
    } catch (error) {
      if (analysisRequestRef.current !== requestId) return;
      notify(error instanceof TypeError
        ? "Could not reach the analysis server. Start the app with npm run dev and try again."
        : error.message || "Could not correct the code.");
    } finally {
      if (analysisRequestRef.current === requestId) {
        setIsAnalyzing(false);
        setIsCorrecting(false);
      }
    }
  }, [code, currentFile, findings, language, notify]);

  const testCode = useCallback(async () => {
    if (!code.trim()) return notify("Paste some code before testing it.");
    if (language === "HTML") {
      const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
      const html = /<head(?:\s[^>]*)?>/i.test(code)
        ? code.replace(/<head(\s[^>]*)?>/i, (head) => `${head}${policy}`)
        : `<!doctype html>${policy}${code}`;
      setActionResult({ type: "html", title: "HTML preview", text: "Preview runs in a sandboxed frame. Network requests and form submissions are blocked.", html });
      return;
    }
    const requestId = ++analysisRequestRef.current;
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Test failed (${response.status}).`);
      if (analysisRequestRef.current !== requestId) return;
      setActionResult({ type: "run", title: data.timedOut ? "Execution timed out" : data.status === "success" ? "Program finished" : "Program reported an error", text: data.timedOut ? "Stopped after the 10-second execution limit." : `Exit code: ${data.exitCode}`, output: data.stdout, errors: data.stderr });
    } catch (error) {
      if (analysisRequestRef.current === requestId) notify(error instanceof TypeError ? "Could not reach the test runner. Start the app with npm run dev and try again." : error.message || "Could not test this code.");
    } finally {
      if (analysisRequestRef.current === requestId) setIsAnalyzing(false);
    }
  }, [code, language, notify]);

  const changeLanguage = useCallback((nextLanguage, options = {}) => {
    if (nextLanguage === language) return;
    if (!options.fromFile && !options.preserveCode && draftDirty && !window.confirm("Change the editor language and replace the current code with its starter example?")) return;
    analysisRequestRef.current += 1;
    setLanguage(nextLanguage);
    if (!options.fromFile) {
      const profile = getLanguageProfile(nextLanguage);
      if (!options.preserveCode) setCode(profile.starter);
      setCurrentFile({ id: `source.${profile.extension}`, name: `source.${profile.extension}` });
      setEditorKey((key) => key + 1);
      setDraftDirty(Boolean(options.preserveCode));
    }
    setFindings([]);
    setSelectedFinding(null);
    setHoveredFinding(null);
    setAnalysisComplete(false);
    setLastReviewDate(null);
  }, [draftDirty, language]);

  const handleFileUpload = useCallback((eventOrFile, suppliedContent) => {
    const candidate = eventOrFile?.target?.files?.[0] ?? eventOrFile;
    const file = typeof File !== "undefined" && candidate instanceof File ? candidate : null;

    if (!file) return;

    if (file.size > 50 * 1024) {
      notify("Please select a file smaller than 50 KB.");
      if (eventOrFile?.target) eventOrFile.target.value = "";
      return;
    }

    const applyContents = (contents) => {
      analysisRequestRef.current += 1;
      setCode(contents);
      setDraftDirty(true);
      setFindings([]);
      setSelectedFinding(null);
      setAnalysisComplete(false);
      setLastReviewDate(null);
      setHoveredFinding(null);
      notify(`Loaded ${file.name}`);
    };

    if (typeof suppliedContent === "string") {
      applyContents(suppliedContent);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => applyContents(String(reader.result || ""));
    reader.onerror = () => notify("Could not read that file.");
    reader.readAsText(file);

    if (eventOrFile?.target) eventOrFile.target.value = "";
  }, [notify]);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCodeCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch {
      notify("Clipboard unavailable. Copy the code manually.");
    }
  }, [code, notify]);

  const exportReport = useCallback(() => {
    const report = {
      application: "KLYRO",
      exportedAt: new Date().toISOString(),
      analysisMode: ANALYSIS_MODE,
      findingCount: findings.length,
      findings,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "klyro-review.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify("Review report exported.");
  }, [findings, notify]);

  const openHistoryItem = useCallback((item) => {
    analysisRequestRef.current += 1;
    setCode(item.code);
    setCurrentFile({ id: item.fileId || item.fileName || "source.js", name: item.fileName || "source.js" });
    setFindings(item.findings);
    setSelectedFinding(item.findings[0]?.id ?? null);
    setHoveredFinding(null);
    setSeverityFilter("all");
    setAnalysisComplete(true);
    setDraftDirty(false);
    setLastReviewDate(new Date(item.date));
    setActivePage("New Review");
  }, []);

  const deleteHistoryItem = useCallback(async (id) => {
    const item = reviewHistory.find((review) => review.id === id);
    if (item?.persisted) {
      try {
        const response = await fetch(`${API_BASE_URL}/reviews/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Could not delete this review from MongoDB.");
      } catch (error) {
        notify(error.message || "Could not delete this review from MongoDB.");
        return;
      }
    }
    setReviewHistory((previous) => previous.filter((item) => item.id !== id));
    notify(item?.persisted ? "Review deleted from MongoDB." : "Review removed from this session.");
  }, [notify, reviewHistory]);

  const applyFindingFix = useCallback((finding) => {
    const fix = finding.fix;

    if (finding.source === "ESLint" && (!fix || !Array.isArray(fix.range) || typeof fix.text !== "string")) {
      notify("This analyzer finding has no exact, safe fix to apply.");
      return;
    }

    if (!fix) {
      notify("No suggested fix is available for this finding.");
      return;
    }

    let updatedCode;

    if (typeof fix === "object" && Array.isArray(fix.range) && typeof fix.text === "string") {
      const [start, end] = fix.range;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > code.length) {
        notify("The analyzer returned an invalid fix range.");
        return;
      }
      updatedCode = code.slice(0, start) + fix.text + code.slice(end);
    } else if (typeof fix === "string") {
      const lines = code.split("\n");
      const lineIndex = Number(finding.line ?? finding.lineNumber ?? finding.loc?.start?.line ?? 1) - 1;

      if (lineIndex < 0 || lineIndex >= lines.length) {
        notify("Could not locate the line for this suggested fix.");
        return;
      }

      if (fix.startsWith("if (") && lines[lineIndex].includes("return total /")) {
        lines.splice(lineIndex, 0, fix);
      } else {
        lines[lineIndex] = fix;
      }
      updatedCode = lines.join("\n");
    } else {
      notify("This finding does not contain an applicable fix.");
      return;
    }

    analysisRequestRef.current += 1;
    setCode(updatedCode);
    setDraftDirty(true);
    setFindings([]);
    setSelectedFinding(null);
    setAnalysisComplete(false);
    setLastReviewDate(null);
    setHoveredFinding(null);
    notify("Suggested fix applied. Review the change before re-analyzing.");
  }, [code, notify]);

  const filteredFindings = findings.filter((item) => {
    const severity = String(item.severity || "").toLowerCase();
    if (severityFilter === "all") return true;
    if (severityFilter === "error") return ["high", "error", "critical"].some((value) => severity.includes(value));
    if (severityFilter === "warning") return ["medium", "warning"].some((value) => severity.includes(value));
    return !["high", "error", "critical", "medium", "warning"].some((value) => severity.includes(value));
  });

  const isDashboard = activePage === "New Review";
  const latestReview = reviewHistory[0] ?? null;
  const totalSavedFindings = reviewHistory.reduce((total, item) => total + Number(item.issueCount || 0), 0);
  const visibleRecentReviews = reviewHistory
    .filter((item) => `${item.fileName || "Review"} ${item.engine || ""}`.toLowerCase().includes(dashboardSearch.toLowerCase()))
    .slice(0, 5);

  return (
    <div className={`app-shell ${activePage === "Dashboard" ? "dashboard-page" : ""} ${sidebarHidden ? "sidebar-hidden" : ""} ${appearance === "light" ? "light-mode" : ""}`}>
      
      {!sidebarHidden && (
        <Sidebar activePage={activePage} onNavigate={navigate} onHide={() => setSidebarHidden(true)} authUser={authUser} onLogin={() => setAuthDialogOpen(true)} onLogout={signOut} />
      )}

      {sidebarHidden && (
        <button
          type="button"
          className="sidebar-reopen-button"
          aria-label="Show sidebar"
          title="Show sidebar"
          onClick={() => setSidebarHidden(false)}
        >
          <PanelLeftOpen size={18} />
        </button>
      )}

      <div className="main-content">
        {!isDashboard && <Topbar activePage={activePage} />}

        {activePage === "Dashboard" && (
          <main className="dashboard-home">
            <section className="compiler-hero">
              <div className="compiler-hero-copy">
                <span className="compiler-eyebrow"><ShieldCheck size={14} /> KLYRO CODE REVIEW</span>
                <h1>Write code.<br /><span>Catch issues early.</span></h1>
                <p>Choose an editor profile to check source syntax and inspect actionable diagnostics.</p>
                <label className="compiler-language-search"><Search size={18} /><input aria-label="Search supported analyzers" placeholder="Search languages and tools" value={analyzerSearch} onChange={(event) => setAnalyzerSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { const match = LANGUAGE_PROFILES.find((item) => item.name.toLowerCase().includes(analyzerSearch.trim().toLowerCase())); if (match) navigate("New Review", { language: match.name }); } }} /><button type="button" aria-label="Open matching analyzer" disabled={!LANGUAGE_PROFILES.some((item) => item.name.toLowerCase().includes(analyzerSearch.trim().toLowerCase()))} onClick={() => { const match = LANGUAGE_PROFILES.find((item) => item.name.toLowerCase().includes(analyzerSearch.trim().toLowerCase())); if (match) navigate("New Review", { language: match.name }); }}>Open editor <ArrowRight size={15} /></button></label>
                <div className="compiler-supported"><span className="compiler-live-dot" /> {LANGUAGE_PROFILES.length} editor profiles · syntax analysis · ESLint fixes for JavaScript and NodeJS</div>
              </div>
              <div className="compiler-hero-art" aria-hidden="true"><div className="compiler-window"><div className="compiler-window-bar"><i /><i /><i /><span>review.js</span></div><pre><span>01</span> <b>function</b> greet(name) {'{'}<br /><span>02</span>   <b>return</b> `Hello, ${'{'}name{'}'}`;<br /><span>03</span> {'}'}<br /><span>04</span><br /><span>05</span> greet("world");</pre><div className="compiler-result"><ShieldCheck size={15} /><span><strong>Ready to review</strong><small>Run ESLint to inspect this file</small></span><ArrowRight size={15} /></div></div></div>
            </section>

            <section className="compiler-discover">
              <div className="compiler-section-title"><div><span>GET STARTED</span><h2>Choose an analyzer</h2></div><button type="button" className="compiler-history-link" onClick={() => navigate("My Reviews")}>My reviews <ArrowRight size={14} /></button></div>
              <div className="compiler-category-tabs" role="tablist" aria-label="Analyzer categories">
                {LANGUAGE_CATEGORIES.map((category) => <button type="button" key={category} role="tab" aria-selected={analyzerCategory === category} className={analyzerCategory === category ? "active" : ""} onClick={() => setAnalyzerCategory(category)}>{category}</button>)}
              </div>
              <div className="compiler-language-grid">
                {LANGUAGE_PROFILES.filter((item) => (analyzerCategory === "Popular" || item.category === analyzerCategory) && item.name.toLowerCase().includes(analyzerSearch.trim().toLowerCase())).map((item) => <button type="button" className="compiler-language-card" key={item.name} onClick={() => navigate("New Review", { language: item.name })}><span className="compiler-language-icon" role="img" aria-label={`${item.name} logo`} style={{ "--language-color": item.color }}>{item.icon ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.icon.path} fill="currentColor" /></svg> : <Database size={29} aria-hidden="true" />}</span><span className="compiler-language-info"><strong>{item.name}</strong><small>{item.description}</small><em>{["JavaScript", "NodeJS", "React"].includes(item.name) ? "ESLint · Safe fixes" : (item.parserLabel || `${item.grammar.toUpperCase()} syntax parser`)}</em></span><ArrowRight size={17} /></button>)}
                {!LANGUAGE_PROFILES.some((item) => (analyzerCategory === "Popular" || item.category === analyzerCategory) && item.name.toLowerCase().includes(analyzerSearch.trim().toLowerCase())) && <div className="compiler-no-results">No matching profile found. Choose another category or search term.</div>}
              </div>
            </section>

            <section className="compiler-lower-grid">
              <div className="dashboard-recent-card">
                <div className="dashboard-section-heading">
                  <div><span>YOUR WORKSPACE</span><h2>Recent reviews</h2></div>
                  <label className="dashboard-search"><Search size={15} /><input aria-label="Search recent reviews" placeholder="Search reviews" value={dashboardSearch} onChange={(event) => setDashboardSearch(event.target.value)} /></label>
                </div>
                {visibleRecentReviews.length ? (
                  <div className="dashboard-review-list">
                    {visibleRecentReviews.map((item) => (
                      <article className="dashboard-review-row" key={item.id}>
                        <span className="dashboard-review-file"><FileCode2 size={17} /></span>
                        <div className="dashboard-review-copy"><strong>{item.fileName || "Code review"}</strong><span>{item.engine || "Static analysis"} · {new Date(item.date).toLocaleString()}</span></div>
                        <span className="dashboard-review-count">{item.issueCount} {item.issueCount === 1 ? "finding" : "findings"}</span>
                        <button type="button" className="dashboard-open-review" onClick={() => openHistoryItem(item)}>Open <ArrowRight size={14} /></button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-empty-reviews"><span><History size={19} /></span><strong>{dashboardSearch ? "No reviews match that search" : "Your review history starts here"}</strong><p>{dashboardSearch ? "Try a file name or clear the search." : "Run a review and it will appear here for quick access."}</p>{dashboardSearch ? <button type="button" onClick={() => setDashboardSearch("")}>Clear search</button> : <button type="button" onClick={() => navigate("New Review")}>Start your first review <ArrowRight size={14} /></button>}</div>
                )}
              </div>

              <aside className="compiler-side-card">
                <span className="dashboard-quick-eyebrow">REVIEW ACTIVITY</span>
                <h2>Your workspace at a glance</h2>
                <div className="compiler-stat"><span>Saved reviews</span><strong>{reviewHistory.length}</strong></div>
                <div className="compiler-stat"><span>Findings tracked</span><strong>{totalSavedFindings}</strong></div>
                <div className="compiler-stat"><span>Latest review</span><strong>{latestReview ? new Date(latestReview.date).toLocaleDateString() : "Not yet"}</strong></div>
                <div className="dashboard-privacy-note"><ShieldCheck size={14} /><span>Review results stay in your local workspace.</span></div>
              </aside>
            </section>
          </main>
        )}

        {isDashboard && (
          <header className="workspace-toolbar">
            <div className="workspace-title-group">
              <span className="workspace-title-icon"><FileCode2 size={17} /></span>
              <div>
                <h1>Review workspace</h1>
              </div>
            </div>

            <div className="workspace-toolbar-actions">
              <button
                type="button"
                aria-label="Dark appearance"
                className={appearance === "dark" ? "workspace-icon-action active" : "workspace-icon-action"}
                onClick={() => setAppearance("dark")}
              >
                <Moon size={16} />
              </button>
              <button
                type="button"
                aria-label="Light appearance"
                className={appearance === "light" ? "workspace-icon-action active" : "workspace-icon-action"}
                onClick={() => setAppearance("light")}
              >
                <Sun size={16} />
              </button>
              <button
                type="button"
                aria-label="Toggle findings panel"
                className={findingsVisible ? "workspace-icon-action active" : "workspace-icon-action"}
                onClick={() => setFindingsVisible((v) => !v)}
              >
                <SlidersHorizontal size={16} />
              </button>
            </div>
          </header>
        )}

        {isDashboard && (
          <main className="dashboard-content workbench-content">
            <section className={`review-workspace ${findingsVisible ? "" : "findings-collapsed"}`}>
              <div className="editor-column">
                <CodeEditor
                  key={editorKey}
                  code={code}
                  onCodeChange={(value, fileContext) => {
                    analysisRequestRef.current += 1;
                    setCode(value);
                    if (fileContext) setCurrentFile(fileContext);
                    setDraftDirty(true);
                    setFindings([]);
                    setSelectedFinding(null);
                    setHoveredFinding(null);
                    setAnalysisComplete(false);
                    setLastReviewDate(null);
                  }}
                  onReview={runReview}
                  onCorrectCode={correctCode}
                  isCorrecting={isCorrecting}
                  onTestCode={testCode}
                  isAnalyzing={isAnalyzing}
                  analysisComplete={analysisComplete}
                  lastReviewDate={lastReviewDate}
                  onCopy={copyCode}
                  codeCopied={codeCopied}
                  onExport={exportReport}
                  language={language}
                  onLanguageChange={changeLanguage}
                  onFileUpload={handleFileUpload}
                  findings={filteredFindings}
                  selectedFinding={hoveredFinding?.id ?? selectedFinding}
                  keymap={keymap}
                />
              </div>

            {findingsVisible && (
              <div className="findings-column">
                <FindingsPanel
                  findings={findings}
                  isAnalyzing={isAnalyzing}
                  analysisComplete={analysisComplete}
                  onSelectFinding={(finding) => setSelectedFinding(finding.id)}
                  onFilterChange={setSeverityFilter}
                  onHoverFinding={setHoveredFinding}
                  onDismissFinding={(finding) => {
                    setFindings((current) => current.filter((item) => item.id !== finding.id));
                    setSelectedFinding(null);
                    setHoveredFinding(null);
                    notify("Finding ignored for this review.");
                  }}
                  onApplyFix={applyFindingFix}
                />
              </div>
            )}
            </section>
          </main>
        )}

        {activePage === "My Reviews" && (
          <main className="dashboard-content page-content">
            <div className="page-heading">
              <div>
                <h1>My Reviews</h1>
                <p>{authUser ? "Your saved code reviews belong to your account and stay private to you." : "Sign in to save code and findings to your private review history."}</p>
              </div>
            </div>

            {!authUser ? (
              <div className="empty-state account-history-gate">
                <h2>Your code history stays private</h2>
                <p>Create an account or sign in to save code reviews and findings. Guest reviews are not added to history or saved in this browser.</p>
                <button type="button" className="primary-button review-code-button" onClick={() => setAuthDialogOpen(true)}>Sign in to view history</button>
              </div>
            ) : reviewHistory.length === 0 ? (
              <div className="empty-state">
                <h2>No reviews yet</h2>
                <p>Run a review while signed in and it will be saved to this account.</p>
                <button
                  type="button"
                  className="primary-button review-code-button"
                  onClick={() => navigate("New Review")}
                >
                  Start a review
                </button>
              </div>
            ) : (
              <div className="history-list">
                {reviewHistory.map((item) => (
                  <article className="history-item" key={item.id}>
                    <div>
                      <h3>
                        {item.fileName || "Review"} · {new Date(item.date).toLocaleString()}
                      </h3>
                      <p>
                        {item.engine || "Static Analysis"} · {item.issueCount} reported issue(s)
                        <span className={`review-storage-badge ${item.persisted ? "remote" : "local"}`}>
                          {item.persisted ? "MongoDB" : "Browser cache"}
                        </span>
                      </p>
                    </div>
                    <div className="history-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openHistoryItem(item)}
                      >
                        Open review
                      </button>
                      <button
                        type="button"
                        className="secondary-button danger-button"
                        onClick={() => deleteHistoryItem(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        )}

        {activePage === "Learning Hub" && (
          <main className="dashboard-content page-content">
            <LearningHub key={authUser?.id || "guest"} apiBaseUrl={API_BASE_URL} reviewHistory={reviewHistory} user={authUser} />
          </main>
        )}

        {activePage === "My Profile" && authUser && (
          <MyProfilePage
            key={authUser.id}
            apiBaseUrl={API_BASE_URL}
            user={authUser}
            role={profile.role}
            onRoleChange={(role) => setProfile((current) => ({ ...current, role }))}
            reviewCount={reviewHistory.length}
            findingCount={totalSavedFindings}
            reviewHistory={reviewHistory}
            databaseStatus={databaseStatus}
            onUserUpdated={(user) => {
              setAuthUser(user);
              setProfile((current) => ({ ...current, name: user.name }));
            }}
            onNotify={notify}
            onNavigate={navigate}
            onDeleted={accountDeleted}
          />
        )}

        {activePage === "Supported Languages" && (
          <main className="dashboard-content page-content">
            <div className="settings-page supported-languages-page">
              <div className="settings-page-heading"><h1>Supported languages &amp; tools</h1><p>Choose a profile to open a review workspace. Analyzer coverage varies by language.</p></div>
              <label className="compiler-language-search"><Search size={18} /><input aria-label="Search supported languages" placeholder="Search languages and tools" value={analyzerSearch} onChange={(event) => setAnalyzerSearch(event.target.value)} /><button type="button" onClick={() => setAnalyzerSearch("")}>Clear</button></label>
              <div className="compiler-language-grid">{LANGUAGE_PROFILES.filter((item) => item.name.toLowerCase().includes(analyzerSearch.trim().toLowerCase())).map((item) => <button type="button" className="compiler-language-card" key={item.name} onClick={() => navigate("New Review", { language: item.name })}><span className="compiler-language-icon" role="img" aria-label={`${item.name} logo`} style={{ "--language-color": item.color }}>{item.icon ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.icon.path} fill="currentColor" /></svg> : <Database size={29} aria-hidden="true" />}</span><span className="compiler-language-info"><strong>{item.name}</strong><small>{item.description}</small><em>{["JavaScript", "NodeJS", "React"].includes(item.name) ? "ESLint · Safe fixes" : (item.parserLabel || `${item.grammar.toUpperCase()} syntax parser`)}</em></span><ArrowRight size={17} /></button>)}</div>
              {!LANGUAGE_PROFILES.some((item) => item.name.toLowerCase().includes(analyzerSearch.trim().toLowerCase())) && <div className="compiler-no-results">No supported profile matches this search.</div>}
            </div>
          </main>
        )}

        {activePage === "Settings" && (
          <main className="dashboard-content page-content">
            <div className="settings-page">
              <div className="settings-page-heading">
                <h1>Settings</h1>
                <p>Personalize your KLYRO workspace.</p>
              </div>

              <section className="settings-card profile-settings-card">
                <div className="settings-card-heading">
                  <h2>Account profile</h2>
                  <p>Edit your display name and workspace role here.</p>
                </div>
                <div className="settings-profile-avatar" aria-hidden="true">
                  {authUser ? ((authUser.name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || "U").toUpperCase()) : "G"}
                </div>
                {authUser ? <form className="settings-inline-profile" onSubmit={async (event) => {
                  event.preventDefault();
                  const name = settingsName.trim();
                  if (!name || name.length > 48) { notify("Enter a display name between 1 and 48 characters."); return; }
                  setProfileSaving(true);
                  try {
                    if (authUser && name !== authUser.name) {
                      const response = await fetch(`${API_BASE_URL}/auth/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ name }) });
                      const data = await response.json().catch(() => ({}));
                      if (!response.ok) throw new Error(data.error || "Could not update your profile.");
                      setAuthUser(data.user);
                    }
                    setProfile((current) => ({ ...current, name }));
                    notify("Profile updated successfully.");
                  } catch (error) { notify(error.message || "Could not update your profile."); }
                  finally { setProfileSaving(false); }
                }}>
                  <label className="settings-field"><span>Display name</span><input value={settingsName} maxLength={48} onChange={(event) => setSettingsName(event.target.value)} /></label>
                  <label className="settings-field"><span>Email address</span><input value={authUser.email} disabled /></label>
                  <label className="settings-field"><span>Role</span><select value={profile.role} onChange={(event) => setProfile((current) => ({ ...current, role: event.target.value }))}>{["Student", "Developer", "Reviewer", "Team lead", "Other"].map((role) => <option key={role}>{role}</option>)}</select></label>
                  <button type="submit" className="primary-button" disabled={profileSaving || !settingsName.trim()}><Save size={14} /> {profileSaving ? "Saving…" : "Save profile"}</button>
                </form> : <div className="settings-guest-profile"><strong>Guest workspace</strong><span>Sign in to view or manage your account details and role.</span><button type="button" className="primary-button" onClick={() => setAuthDialogOpen(true)}>Sign in</button></div>}
              </section>

              <section className="settings-card">
                <div className="settings-card-heading">
                  <h2>Appearance</h2>
                  <p>Choose the workspace theme.</p>
                </div>
                <div className="settings-choice-row" role="group" aria-label="Appearance">
                  {[{ id: "dark", label: "Dark" }, { id: "light", label: "Light" }].map((option) => (
                    <button key={option.id} type="button" className={`settings-choice ${appearance === option.id ? "selected" : ""}`} aria-pressed={appearance === option.id} onClick={() => setAppearance(option.id)}>
                      <span className={`settings-theme-swatch ${option.id}`} aria-hidden="true" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-card">
                <div className="settings-card-heading">
                  <h2>Review defaults</h2>
                  <p>Set the starting language and see what each analyzer checks.</p>
                </div>
                <label className="settings-field">
                  <span>Default editor language</span>
                  <select value={language} onChange={(event) => changeLanguage(event.target.value)}>
                    {EDITOR_LANGUAGES.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
                <label className="settings-field"><span>Review strictness</span><select value={strictness} onChange={(event) => setStrictness(event.target.value)}><option value="lenient">Lenient</option><option value="standard">Standard</option><option value="strict">Strict / nitpicky</option><option value="security">Security-focused</option></select></label>
                <label className="settings-field"><span>Code editor keymap</span><select value={keymap} onChange={(event) => setKeymap(event.target.value)}><option value="vscode">VS Code</option><option value="vim">Vim (basic normal/insert keys)</option><option value="emacs">Emacs (Ctrl+A / Ctrl+E line navigation)</option></select></label>
                <div className="settings-info-row">
                  <strong>Static analysis</strong>
                  <span>Strictness applies to ESLint profiles (JavaScript, NodeJS, React). Other profiles report parser syntax errors; framework and dependency behavior are not checked.</span>
                </div>
                <div className="settings-rules-upload"><label className="settings-field"><span>Custom ESLint rules JSON</span><input type="file" accept=".json,.eslintrc,.eslintrc.json,application/json" onChange={async (event) => {
                  const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (!file) return;
                  try { const config = JSON.parse(await file.text()); const rules = config.rules || config; if (!rules || typeof rules !== "object" || Array.isArray(rules)) throw new Error("Expected a JSON object containing a rules object."); setCustomRules(rules); notify(`Loaded ${Object.keys(rules).length} custom ESLint rules.`); }
                  catch (error) { notify(`Could not load rules: ${error.message}`); }
                }} /></label><span>{Object.keys(customRules).length ? `${Object.keys(customRules).length} custom rule(s) loaded for your next review.` : "Upload a JSON ESLint rules config. Rules apply only to JavaScript, NodeJS, and React."}</span>{Object.keys(customRules).length > 0 && <button type="button" className="secondary-button" onClick={() => { setCustomRules({}); notify("Custom rules removed."); }}>Remove custom rules</button>}</div>
              </section>

              <section className="settings-card">
                <div className="settings-card-heading"><h2><Bell size={15} /> Notification preferences</h2><p>Choose which in-app notices you want to see on this device.</p></div>
                {[["reviewComplete", "Review completion"], ["mentions", "Mentions"], ["systemUpdates", "System updates"]].map(([key, label]) => <label className="settings-toggle-row" key={key}><span>{label}</span><input type="checkbox" checked={notificationPreferences[key] !== false} onChange={(event) => setNotificationPreferences((current) => ({ ...current, [key]: event.target.checked }))} /></label>)}
                <p className="settings-note">Preferences save in this browser. Email delivery and team mentions require notification services that are not configured in this workspace.</p>
              </section>

              <section className="settings-card">
                <div className="settings-card-heading"><h2>Connected accounts</h2><p>Import repositories after connecting a provider.</p></div>
                {["GitHub", "GitLab", "Bitbucket"].map((provider) => <div className="settings-integration-row" key={provider}><span>{provider === "GitHub" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d={siGithub.path} /></svg> : <GitBranch size={16} />} {provider}</span><span className="integration-unavailable">OAuth setup required</span><button type="button" disabled title={`${provider} OAuth credentials and callback are not configured`}>Connect</button></div>)}
                <p className="settings-note">Repository OAuth is not configured for this app yet, so no account is connected and imports are unavailable.</p>
              </section>

              <section className="settings-card">
                <div className="settings-card-heading">
                  <h2>Review history</h2>
                  <p>Code and findings are stored in MongoDB only for signed-in accounts. Guest reviews are not saved to history.</p>
                </div>
                <div className={`database-connection-status ${databaseStatus}`} role="status">
                  <span className="status-dot" />
                  <span>Storage status</span>
                  <strong>{databaseStatus === "connected" ? "MongoDB connected" : databaseStatus === "checking" ? "Checking MongoDB" : "MongoDB unavailable"}</strong>
                </div>
              </section>

            </div>
          </main>
        )}

        <footer className="app-footer">
          <div className="app-footer-inner">
            <section className="app-footer-brand" aria-labelledby="footer-brand-title">
              <h2 id="footer-brand-title">KLYRO</h2>
              <p>Find issues early. Keep your code yours.</p>
              <button type="button" onClick={() => navigate("Learning Hub")}>About KLYRO</button>
              <button type="button" onClick={() => navigate("My Reviews")}>Your reviews</button>
              <div className="app-footer-socials" aria-label="Social profiles">
                <a href="https://github.com/0vansh0" target="_blank" rel="noopener noreferrer" aria-label="Vansh Raj on GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={siGithub.path} /></svg> GitHub</a>
                <a href="https://www.linkedin.com/in/vanshraj00" target="_blank" rel="noopener noreferrer" aria-label="Vansh Raj on LinkedIn"><span className="app-footer-linkedin-mark" aria-hidden="true">in</span> LinkedIn</a>
              </div>
              <span className="app-footer-status"><i /> Local workspace ready</span>
            </section>

            <section className="app-footer-languages" aria-labelledby="footer-languages-title">
              <h2 id="footer-languages-title">Documentation</h2>
              <button type="button" onClick={() => navigate("Supported Languages")}>Supported languages &amp; tools</button>
            </section>

            <section className="app-footer-more" aria-labelledby="footer-more-title">
              <h2 id="footer-more-title">Explore</h2>
              <button type="button" onClick={() => navigate("Dashboard")}>Dashboard</button>
              <button type="button" onClick={() => navigate("New Review")}>New review</button>
              <button type="button" onClick={() => navigate("My Reviews")}>Review history</button>
              <button type="button" onClick={() => navigate("Learning Hub")}>Learning hub</button>
              <button type="button" onClick={() => navigate("Settings")}>Settings</button>
              <button type="button" onClick={() => navigate("Supported Languages")}>Supported languages</button>
              <span className="app-footer-version">© {new Date().getFullYear()} KLYRO</span>
            </section>
          </div>
        </footer>

        {actionResult && (
          <div className="action-result-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActionResult(null); }}>
            <section className="action-result-dialog" role="dialog" aria-modal="true" aria-labelledby="action-result-title">
              <button type="button" className="action-result-close" onClick={() => setActionResult(null)} aria-label="Close">×</button>
              <h2 id="action-result-title">{actionResult.title}</h2>
              <p>{actionResult.text}</p>
              {actionResult.type === "repair" ? (
                <>
                  <label className="action-result-label" htmlFor="repair-source">Suggested full-file code</label>
                  <textarea id="repair-source" className="action-result-code" readOnly value={actionResult.corrected} />
                  <div className="action-result-actions">
                    <button type="button" className="secondary-button" onClick={() => setActionResult(null)}>Keep current code</button>
                    <button type="button" className="primary-button" onClick={() => { setCode(actionResult.corrected); setDraftDirty(true); setFindings([]); setAnalysisComplete(false); setLastReviewDate(null); setActionResult(null); notify("Suggested correction applied. Review and test it before relying on it."); }}>Apply suggested code</button>
                  </div>
                </>
              ) : (
                <>
                  {actionResult.type === "html" ? (
                    <iframe className="action-result-html" title="HTML code preview" sandbox="allow-scripts" srcDoc={actionResult.html} />
                  ) : actionResult.output && <pre className="action-result-output">{actionResult.output}</pre>}
                  {actionResult.errors && <pre className="action-result-output error">{actionResult.errors}</pre>}
                  {actionResult.type !== "html" && !actionResult.output && !actionResult.errors && <pre className="action-result-output">No output</pre>}
                  <button type="button" className="primary-button" onClick={() => setActionResult(null)}>Close</button>
                </>
              )}
            </section>
          </div>
        )}

        {authDialogOpen && <AuthDialog apiBaseUrl={API_BASE_URL} initialName={profile.name} initialAction={authAction} actionToken={authActionToken} onClose={() => { setAuthDialogOpen(false); setAuthAction(""); setAuthActionToken(""); }} onSuccess={finishSignIn} />}

        {toast && (
          <div className="toast-message" role="status">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
