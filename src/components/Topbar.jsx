import {
  CircleHelp,
} from "lucide-react";

export default function Topbar({ activePage = "Dashboard" }) {
  const pageDescriptions = {
    Dashboard: "Your code quality overview",
    "New Review": "Analyze code and detect potential issues",
    "My Reviews": "View your previous code analyses",
    "Learning Hub": "Improve your coding and debugging skills",
    "My Profile": "Manage your account and saved code reviews",
    Settings: "Manage your workspace preferences",
    "Supported Languages": "Explore available language and tool analyzers",
  };

  return (
    <header className="topbar klyro-topbar">
      <div className="topbar-heading">
        <h1 className="page-title">{activePage}</h1>
        <p className="topbar-description">
          {pageDescriptions[activePage] || "Your code review workspace"}
        </p>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="topbar-help-button"
          title="Help and information"
          aria-label="Help and information"
          onClick={() =>
            window.__klyroToast?.(
              "KLYRO — review your code, inspect findings, and learn how to fix issues."
            )
          }
        >
          <CircleHelp size={18} />
        </button>
      </div>
    </header>
  );
}
