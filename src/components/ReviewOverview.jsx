
import {
  ShieldCheck,
  ShieldAlert,
  Bug,
  AlertTriangle,
  CheckCircle2,
  Activity,
  FileCode2,
  Clock3,
} from "lucide-react";

function getSeverity(finding) {
  const value = String(
    finding.severity ?? finding.type ?? finding.level ?? "info"
  ).toLowerCase();

  if (
    value === "2" ||
    value.includes("fatal") ||
    value.includes("error") ||
    value.includes("critical") ||
    value.includes("high")
  ) {
    return "error";
  }

  if (
    value === "1" ||
    value.includes("warning") ||
    value.includes("warn") ||
    value.includes("medium")
  ) {
    return "warning";
  }

  return "info";
}

export default function ReviewOverview({
  findings = [],
  isAnalyzing = false,
  analysisComplete = false,
  code = "",
  analysisMode = "eslint",
  lastReviewDate = null,
}) {
  const safeFindings = Array.isArray(findings) ? findings : [];

  const errorCount = safeFindings.filter(
    (finding) => getSeverity(finding) === "error"
  ).length;

  const warningCount = safeFindings.filter(
    (finding) => getSeverity(finding) === "warning"
  ).length;

  const infoCount = safeFindings.filter(
    (finding) => getSeverity(finding) === "info"
  ).length;

  const totalFindings = safeFindings.length;

  const securityStatus = !analysisComplete
    ? "Not analyzed"
    : errorCount > 0
      ? "Issues detected"
      : warningCount > 0
        ? "Review recommended"
        : "No reported issues";

  const statusClass = !analysisComplete
    ? "neutral"
    : errorCount > 0
      ? "danger"
      : warningCount > 0
        ? "warning"
        : "success";

  const metrics = [
    {
      label: "Total findings",
      value: totalFindings,
      icon: Bug,
      color: "purple",
      description: "Reported by analyzer",
    },
    {
      label: "Errors",
      value: errorCount,
      icon: ShieldAlert,
      color: "red",
      description: "Errors to investigate",
    },
    {
      label: "Warnings",
      value: warningCount,
      icon: AlertTriangle,
      color: "yellow",
      description: "Potential improvements",
    },
    {
      label: "Informational",
      value: infoCount,
      icon: Activity,
      color: "blue",
      description: "Additional observations",
    },
  ];

  const formatDate = (value) => {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not available";
    }

    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <section className="review-overview-component">
      <div className="review-overview-heading">
        <div>
          <div className="review-overview-eyebrow">
            <Activity size={14} />
            ANALYSIS SUMMARY
          </div>

          <h2>Review Overview</h2>

          <p>
            A quick summary of the latest code analysis.
          </p>
        </div>

        <div className={`overview-status-icon ${statusClass}`}>
          {statusClass === "success" ? (
            <ShieldCheck size={22} />
          ) : statusClass === "danger" ? (
            <ShieldAlert size={22} />
          ) : statusClass === "warning" ? (
            <AlertTriangle size={22} />
          ) : (
            <FileCode2 size={22} />
          )}
        </div>
      </div>

      <div className="review-overview-metrics">
        {metrics.map(({ label, value, icon: Icon, color, description }) => (
          <article className="overview-metric-card" key={label}>
            <div className={`overview-metric-icon ${color}`}>
              <Icon size={17} />
            </div>

            <div className="overview-metric-label">{label}</div>

            <div className="overview-metric-value">
              {isAnalyzing ? "—" : value}
            </div>

            <div className="overview-metric-description">
              {description}
            </div>
          </article>
        ))}
      </div>

      <div className={`overview-security-status ${statusClass}`}>
        <div className={`overview-security-icon ${statusClass}`}>
          {statusClass === "success" ? (
            <CheckCircle2 size={18} />
          ) : statusClass === "danger" ? (
            <ShieldAlert size={18} />
          ) : statusClass === "warning" ? (
            <AlertTriangle size={18} />
          ) : (
            <ShieldCheck size={18} />
          )}
        </div>

        <div className="overview-security-copy">
          <div className="overview-security-title">
            {isAnalyzing ? "Analysis in progress" : securityStatus}
          </div>

          <p>
            {isAnalyzing
              ? "Please wait while your source code is being analyzed."
              : !analysisComplete
                ? "Run a review to see findings for your source code."
                : errorCount > 0
                  ? "Review the reported errors and investigate their impact before relying on this code."
                  : warningCount > 0
                    ? "No errors were reported, but warnings still deserve attention."
                    : "The analyzer reported no errors or warnings. This does not guarantee the code is free of bugs or security vulnerabilities."}
          </p>
        </div>
      </div>

      <div className="overview-details">
        <div className="overview-detail-row">
          <div className="overview-detail-label">
            <FileCode2 size={15} />
            Source size
          </div>

          <span>
            {code.length.toLocaleString()} characters
          </span>
        </div>

        <div className="overview-detail-row">
          <div className="overview-detail-label">
            <Activity size={15} />
            Analysis mode
          </div>

          <span>
            {analysisMode === "eslint"
              ? "JavaScript · ESLint static analysis"
              : analysisMode === "security"
                ? "Security scan · Demo heuristic"
                : "Performance scan · Demo heuristic"}
          </span>
        </div>

        <div className="overview-detail-row">
          <div className="overview-detail-label">
            <Clock3 size={15} />
            Last review
          </div>

          <span>
            {analysisComplete
              ? formatDate(lastReviewDate)
              : "Not reviewed yet"}
          </span>
        </div>
      </div>
    </section>
  );
}
