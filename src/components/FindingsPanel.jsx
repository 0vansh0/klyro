import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Bug,
  ChevronDown,
  ChevronRight,
  Wrench,
  X,
} from "lucide-react";

function getSeverity(finding) {
  const value = String(
    finding.severity ?? finding.type ?? finding.level ?? "info"
  ).toLowerCase();

  if (
    value === "2" ||
    value.includes("fatal") ||
    value.includes("critical") ||
    value.includes("error") ||
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

  if (value.includes("success") || value.includes("passed")) {
    return "success";
  }

  return "info";
}

function getFindingTitle(finding) {
  return (
    finding.title ||
    finding.message ||
    finding.ruleId ||
    finding.rule ||
    "Code issue detected"
  );
}

function getFindingMessage(finding) {
  return (
    finding.description ||
    finding.message ||
    finding.reason ||
    "Review this section of your code."
  );
}

function getFindingIcon(severity) {
  if (severity === "error") return AlertCircle;
  if (severity === "warning") return AlertTriangle;
  if (severity === "success") return CheckCircle2;
  return Info;
}

function formatFix(finding) {
  const fix = finding.fix ?? finding.suggestion;

  if (!fix) {
    return "Review this line and add the appropriate guard.";
  }

  if (typeof fix === "string") {
    return fix;
  }

  if (typeof fix === "object") {
    return fix.text || fix.description || JSON.stringify(fix, null, 2);
  }

  return String(fix);
}

function hasApplicableFix(finding) {
  const fix = finding.fix;
  if (finding.source === "ESLint") {
    return Boolean(
      fix &&
        Array.isArray(fix.range) &&
        fix.range.length === 2 &&
        fix.range.every(Number.isInteger) &&
        fix.range[0] >= 0 &&
        fix.range[1] >= fix.range[0] &&
        typeof fix.text === "string"
    );
  }
  return typeof fix === "string" && fix.length > 0;
}

const FILTERS = [
  { id: "all", label: "All findings" },
  { id: "error", label: "Errors" },
  { id: "warning", label: "Warnings" },
  { id: "info", label: "Info" },
];

export default function FindingsPanel({
  findings = [],
  isAnalyzing = false,
  analysisComplete = false,
  onSelectFinding = () => {},
  onFilterChange = () => {},
  onHoverFinding = () => {},
  onApplyFix = () => {},
  onDismissFinding = () => {},
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedFinding, setExpandedFinding] = useState(null);

  const normalizedFindings = useMemo(() => {
    if (!Array.isArray(findings)) return [];

    return findings.map((finding, index) => {
      const id = finding.id ?? `${finding.ruleId ?? "finding"}-${index}`;

      return {
        ...finding,
        id,
        _id: id,
        _severity: getSeverity(finding),
      };
    });
  }, [findings]);

  const counts = useMemo(
    () => ({
      error: normalizedFindings.filter(
        (finding) => finding._severity === "error"
      ).length,
      warning: normalizedFindings.filter(
        (finding) => finding._severity === "warning"
      ).length,
      info: normalizedFindings.filter(
        (finding) => finding._severity === "info"
      ).length,
    }),
    [normalizedFindings]
  );

  const filteredFindings = useMemo(() => {
    if (activeFilter === "all") return normalizedFindings;

    return normalizedFindings.filter(
      (finding) => finding._severity === activeFilter
    );
  }, [normalizedFindings, activeFilter]);

  const changeFilter = (filter) => {
    const next = activeFilter === filter && filter !== "all"
      ? "all"
      : filter;

    setActiveFilter(next);
    onFilterChange(next);
  };

  return (
    <section className="findings-panel-component">
      <div className="findings-panel-header">
        <div>
          <div className="findings-heading">
            <h2>Review Findings ({normalizedFindings.length})</h2>
          </div>

          <p className="findings-subtitle">
            Issues and recommendations from your code review.
          </p>
        </div>

        <div className="findings-header-icon" aria-hidden="true">
          <Bug size={18} />
        </div>
      </div>

      <div className="finding-stats">
        <button
          type="button"
          className={`finding-stat error ${
            activeFilter === "error" ? "selected" : ""
          }`}
          onClick={() => changeFilter("error")}
          aria-pressed={activeFilter === "error"}
        >
          <span className="finding-stat-label">Errors</span>
          <span className="finding-stat-value">
            {counts.error}
          </span>
        </button>

        <button
          type="button"
          className={`finding-stat warning ${
            activeFilter === "warning" ? "selected" : ""
          }`}
          onClick={() => changeFilter("warning")}
          aria-pressed={activeFilter === "warning"}
        >
          <span className="finding-stat-label">Warnings</span>
          <span className="finding-stat-value">
            {counts.warning}
          </span>
        </button>

        <button
          type="button"
          className={`finding-stat info ${
            activeFilter === "info" ? "selected" : ""
          }`}
          onClick={() => changeFilter("info")}
          aria-pressed={activeFilter === "info"}
        >
          <span className="finding-stat-label">Info</span>
          <span className="finding-stat-value">
            {counts.info}
          </span>
        </button>
      </div>

      <div className="findings-filter-row" aria-label="Filter findings">
        {FILTERS.map((filter) => (
          <button
            type="button"
            key={filter.id}
            className={`findings-filter-chip ${
              activeFilter === filter.id ? "active" : ""
            }`}
            onClick={() => changeFilter(filter.id)}
            aria-pressed={activeFilter === filter.id}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="findings-items">
        {isAnalyzing ? (
          <div className="findings-empty-state">
            <div className="findings-loading-spinner" />
            <div className="findings-empty-title">
              Analyzing your code
            </div>
            <p>
              Checking for potential bugs and code quality issues...
            </p>
          </div>
        ) : filteredFindings.length > 0 ? (
          filteredFindings.map((finding) => {
            const severity = finding._severity;
            const Icon = getFindingIcon(severity);
            const isExpanded = expandedFinding === finding._id;

            const line =
              finding.line ??
              finding.lineNumber ??
              finding.loc?.start?.line;

            const column =
              finding.column ??
              finding.columnNumber ??
              finding.loc?.start?.column;

            const rule = finding.ruleId ?? finding.rule;

            return (
              <article
                key={finding._id}
                className={`finding-card finding-card-${severity} ${
                  isExpanded ? "expanded" : ""
                }`}
              >
                <button
                  type="button"
                  className="finding-card-main"
                  onClick={() => {
                    setExpandedFinding(
                      isExpanded ? null : finding._id
                    );
                    onSelectFinding(finding);
                  }}
                  onMouseEnter={() => onHoverFinding(finding)}
                  onMouseLeave={() => onHoverFinding(null)}
                  aria-expanded={isExpanded}
                >
                  <span className={`finding-card-icon ${severity}`}>
                    <Icon size={17} />
                  </span>

                  <span className="finding-card-content">
                    <span className="finding-card-title">
                      {getFindingTitle(finding)}
                    </span>

                    <span className="finding-card-meta">
                      {line ? `Line ${line}` : "Location unavailable"}
                      {column ? ` · Column ${column}` : ""}
                      {rule ? ` · ${rule}` : ""}
                    </span>
                  </span>

                  <span className={`finding-severity-pill ${severity}`}>
                    {severity === "error"
                      ? "Error"
                      : severity === "warning"
                        ? "Warning"
                        : severity === "success"
                          ? "Passed"
                          : "Info"}
                  </span>

                  <span className="finding-expand-icon">
                    {isExpanded ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </span>
                </button>

                {isExpanded && (
                  <div className="finding-expanded-content">
                    <p>{getFindingMessage(finding)}</p>

                    <div className="finding-suggestion">
                      <div className="finding-suggestion-heading">
                        <Wrench size={14} />
                        <strong>Suggested Fix</strong>
                      </div>

                      <pre>{formatFix(finding)}</pre>

                      {hasApplicableFix(finding) && (
                        <button
                          type="button"
                          className="apply-fix-button"
                          onClick={() => onApplyFix(finding)}
                        >
                          Apply Fix
                        </button>
                      )}
                    </div>

                    {finding.help && (
                      <p className="finding-help">{finding.help}</p>
                    )}

                    <button
                      type="button"
                      className="dismiss-finding-button"
                      onClick={() => {
                        onDismissFinding(finding);
                        setExpandedFinding(null);
                      }}
                    >
                      <X size={14} />
                      Ignore finding
                    </button>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <div className="findings-empty-state">
            {analysisComplete ? (
              <>
                <CheckCircle2
                  size={30}
                  className="findings-success-icon"
                />

                <div className="findings-empty-title">
                  {normalizedFindings.length === 0
                    ? "No findings to display"
                    : "No matching findings"}
                </div>

                <p>
                  {normalizedFindings.length === 0
                    ? "No issues were returned by this analysis."
                    : "Try selecting a different severity filter."}
                </p>

                {activeFilter !== "all" && (
                  <button
                    type="button"
                    className="findings-reset-filter"
                    onClick={() => changeFilter("all")}
                  >
                    Clear filter
                  </button>
                )}
              </>
            ) : (
              <div className="findings-empty-copy">
                <div className="findings-empty-title">No review results</div>
                <p>Run analysis from the editor toolbar to inspect this file.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {activeFilter !== "all" && (
        <div className="findings-panel-footer">
          <span>
            <span className="findings-footer-dot" />
            {isAnalyzing
              ? "Analysis in progress"
              : "Showing filtered results"}
          </span>

          <button
            type="button"
            className="findings-reset-filter"
            onClick={() => changeFilter("all")}
          >
            Clear filter
          </button>
        </div>
      )}
    </section>
  );
}
