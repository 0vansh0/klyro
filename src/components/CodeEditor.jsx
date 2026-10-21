import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Play,
  RotateCcw,
  LoaderCircle,
  Copy,
  Check,
  Download,
  Maximize2,
  MoreHorizontal,
  Code2,
} from "lucide-react";
import { LANGUAGE_PROFILES, getLanguageProfile } from "../languages";

const DEFAULT_CODE = `function greetUser(user) {
  return "Hello, " + user.name.toUpperCase();
}

function calculateAverage(numbers) {
  const total = numbers.reduce((sum, n) => sum + n, 0);
  return total / numbers.length;
}

export { greetUser, calculateAverage };`;

let nextFileId = 1;

function createFile(name, code) {
  return { id: `file-${nextFileId++}`, name, code };
}

function detectLanguage(code, filename = "") {
  const extension = filename.split(".").pop()?.toLowerCase();
  const matchedProfile = LANGUAGE_PROFILES.find((profile) => profile.extension === extension);
  if (matchedProfile) return matchedProfile.name;

  try {
    JSON.parse(code);
    return "JSON";
  } catch {
    return "JavaScript";
  }
}

export default function CodeEditor({
  code = DEFAULT_CODE,
  onCodeChange = () => {},
  onReview = () => {},
  onCorrectCode = null,
  onTestCode = null,
  isCorrecting = false,
  isAnalyzing = false,
  language = "JavaScript",
  onLanguageChange = () => {},
  onFileUpload = () => {},
  findings = [],
  selectedFinding = null,
  analysisComplete = false,
  lastReviewDate = null,
  onCopy = () => {},
  codeCopied = false,
  onExport = () => {},
  keymap = "vscode",
}) {
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const highlightRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const menuRef = useRef(null);

  const [localError, setLocalError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [vimMode, setVimMode] = useState("INSERT");
  const vimModeRef = useRef("INSERT");
  const [files, setFiles] = useState(() => {
    const profile = getLanguageProfile(language);
    return [createFile(`source.${profile.extension}`, code || profile.starter || DEFAULT_CODE)];
  });
  const [activeFile, setActiveFile] = useState(0);
  const lineCount = Math.max(1, code.split("\n").length);
  const activeFileCode = files[activeFile]?.code;

  if (activeFileCode !== undefined && activeFileCode !== code) {
    setFiles((currentFiles) =>
      currentFiles.map((file, index) =>
        index === activeFile ? { ...file, code } : file
      )
    );
  }

  useEffect(() => {
    if (!menuOpen) return undefined;

    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [menuOpen]);

  useEffect(() => {
    if (!lastReviewDate) {
      return undefined;
    }

    const updateElapsed = () => {
      const reviewTime =
        lastReviewDate instanceof Date
          ? lastReviewDate.getTime()
          : new Date(lastReviewDate).getTime();

      if (Number.isFinite(reviewTime)) {
        setElapsedSeconds(
          Math.max(0, Math.floor((Date.now() - reviewTime) / 1000))
        );
      }
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);

    return () => window.clearInterval(timer);
  }, [lastReviewDate]);

  const syncCode = (value) => {
    const active = files[activeFile];
    onCodeChange(value, { id: active?.id ?? "source.js", name: active?.name ?? "source.js" });

    setFiles((currentFiles) =>
      currentFiles.map((file, index) =>
        index === activeFile ? { ...file, code: value } : file
      )
    );
  };

  const handleEditorKeyDown = (event) => {
    const editor = editorRef.current;
    if (!editor) return;
    const position = editor.selectionStart;
    if (keymap === "emacs" && event.ctrlKey && !event.altKey) {
      if (event.key.toLowerCase() === "a" || event.key.toLowerCase() === "e") {
        event.preventDefault();
        const lineStart = code.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
        const newline = code.indexOf("\n", position);
        const next = event.key.toLowerCase() === "a" ? lineStart : (newline < 0 ? code.length : newline);
        editor.setSelectionRange(next, next);
      }
      return;
    }
    if (keymap !== "vim") return;
    const move = (next) => { event.preventDefault(); const bounded = Math.max(0, Math.min(code.length, next)); editor.setSelectionRange(bounded, bounded); };
    if (vimModeRef.current === "INSERT") {
      if (event.key === "Escape") { event.preventDefault(); vimModeRef.current = "NORMAL"; setVimMode("NORMAL"); }
      return;
    }
    if (event.key === "i") { event.preventDefault(); vimModeRef.current = "INSERT"; setVimMode("INSERT"); return; }
    if (event.key === "h") move(position - 1);
    else if (event.key === "l") move(position + 1);
    else if (event.key === "j" || event.key === "k") {
      const lineStart = code.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
      const column = position - lineStart;
      const targetStart = event.key === "j" ? code.indexOf("\n", position) + 1 : code.lastIndexOf("\n", Math.max(0, lineStart - 2)) + 1;
      if (targetStart > 0) {
        const targetEndIndex = code.indexOf("\n", targetStart);
        const targetEnd = targetEndIndex < 0 ? code.length : targetEndIndex;
        move(Math.min(targetStart + column, targetEnd));
      }
    } else if (event.key === "x" && position < code.length) {
      event.preventDefault();
      syncCode(`${code.slice(0, position)}${code.slice(position + 1)}`);
    }
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!LANGUAGE_PROFILES.some((profile) => profile.extension === extension)) {
      setLocalError("This file type is not supported by the available analyzers.");
      event.target.value = "";
      return;
    }

    if (file.size > 51200) {
      setLocalError("File is too large. The maximum size is 50 KB.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const value = String(reader.result || "");
      const nextLanguage = detectLanguage(value, file.name);

      const nextFile = createFile(file.name, value);
      setFiles((currentFiles) => [...currentFiles, nextFile]);
      setActiveFile(files.length);
      onCodeChange(value, { id: nextFile.id, name: nextFile.name });

      onFileUpload(file, value);
      onLanguageChange(nextLanguage, { fromFile: true });
      setLocalError("");
    };

    reader.onerror = () => {
      setLocalError("Unable to read this file. Please try another file.");
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const reset = () => {
    const active = files[activeFile];
    const profile = getLanguageProfile(language);
    const starter = profile.starter || DEFAULT_CODE;
    const resetFile = { ...active, name: `source.${profile.extension}`, code: starter };
    onCodeChange(starter, { id: resetFile.id, name: resetFile.name });
    setLocalError("");

    setFiles((currentFiles) =>
      currentFiles.map((file, index) =>
        index === activeFile
          ? resetFile
          : file
      )
    );
  };

  const lineFinding = (line) =>
    findings.find(
      (finding) =>
        Number(
          finding.line ??
            finding.lineNumber ??
            finding.loc?.start?.line
        ) === line
    );

  useEffect(() => {
    const finding = findings.find(
      (item) => item.id === selectedFinding
    );

    const line = Number(
      finding?.line ??
        finding?.lineNumber ??
        finding?.loc?.start?.line
    );

    if (!line || !editorRef.current) return;

    const editor = editorRef.current;
    const lineHeight =
      Number.parseFloat(getComputedStyle(editor).lineHeight) || 20;

    editor.scrollTop = Math.max(
      0,
      (line - 1) * lineHeight - editor.clientHeight / 2
    );

    if (highlightRef.current) {
      highlightRef.current.scrollTop = editor.scrollTop;
      highlightRef.current.scrollLeft = editor.scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = editor.scrollTop;
    }
  }, [selectedFinding, findings]);

  const syncScroll = (event) => {
    if (!highlightRef.current) return;

    highlightRef.current.scrollTop = event.currentTarget.scrollTop;
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
    }
  };

  const renderHighlightedLine = (lineText, lineNumber) => {
    const finding = lineFinding(lineNumber);
    const selected = finding?.id === selectedFinding;
    const hasIssue = Boolean(finding);

    const tokenPattern =
      /(user\.name|total \/ numbers\.length|"[^"\n]*"|'[^'\n]*'|`[^`\n]*`|\b(?:function|return|const|let|var|export|import|from|if|else|new|class|async|await)\b|\b(?:greetUser|calculateAverage|reduce|toUpperCase|length)\b|\b\d+\b)/g;

    const tokenMatches = [...lineText.matchAll(tokenPattern)];
    const renderedParts = [];
    let cursor = 0;

    tokenMatches.forEach((match, index) => {
      const [token] = match;
      const start = match.index ?? cursor;

      if (start > cursor) {
        renderedParts.push(lineText.slice(cursor, start));
      }

      renderedParts.push({ token, index });
      cursor = start + token.length;
    });

    if (cursor < lineText.length) {
      renderedParts.push(lineText.slice(cursor));
    }

    return (
      <span
        className={`code-highlight-line ${hasIssue ? `has-finding ${String(finding.severity || "").toLowerCase()}` : ""} ${selected ? "focused" : ""}`}
        key={lineNumber}
      >
        {renderedParts.map((part, index) => {
          if (typeof part === "string") {
            return <span key={index}>{part}</span>;
          }

          const { token } = part;

          let tokenClass = "";

          if (
            /^(function|return|const|let|var|export|import|from|if|else|new|class|async|await)$/.test(
              token
            )
          ) {
            tokenClass = "syntax-keyword";
          } else if (
            /^(?:"[^"\n]*"|'[^'\n]*'|`[^`\n]*`)$/.test(token)
          ) {
            tokenClass = "syntax-string";
          } else if (
            /^(greetUser|calculateAverage|reduce|toUpperCase|length)$/.test(
              token
            )
          ) {
            tokenClass = "syntax-function";
          } else if (/^\d+$/.test(token)) {
            tokenClass = "syntax-number";
          }

          return (
            <span className={tokenClass} key={index}>
              {token}
            </span>
          );
        })}
      </span>
    );
  };

  const handleReview = () => {
    if (!code.trim()) {
      setLocalError("Enter some code before starting the review.");
      return;
    }

    setLocalError("");
    onReview();
  };

  return (
    <section
      className={`code-editor-component ${expanded ? "editor-expanded" : ""}`}
    >
      <div className="editor-titlebar">
        <div className="editor-title"><Code2 size={15} /><span>Code</span></div>
        <button type="button" className="editor-more-button" aria-label={expanded ? "Exit full screen editor" : "Expand editor"} title={expanded ? "Exit full screen editor" : "Expand editor"} onClick={() => setExpanded((value) => !value)}>
          <Maximize2 size={15} />
        </button>
      </div>

      <div className="editor-controls">
        <div className="editor-file-tabs editor-language-tools">
          <div className="editor-context-label" title="Choose a language or project profile for this file">
            <select
              className="editor-language-select"
              aria-label="Editor language"
              value={language}
              onChange={(event) => onLanguageChange(event.target.value)}
            >
              {LANGUAGE_PROFILES.map(({ name }) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <button type="button" className="editor-auto-button" title="Detect language from the current file" onClick={() => onLanguageChange(detectLanguage(code, files[activeFile]?.name), { preserveCode: true })}>Auto</button>
          <span className="editor-mode-label">{getLanguageProfile(language).grammar === "javascript" ? "ESLint" : `${getLanguageProfile(language).grammar.toUpperCase()} syntax`}</span>
        </div>

        <div className="editor-control-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept={[...new Set(LANGUAGE_PROFILES.map(({ extension }) => `.${extension}`))].join(",")}
            onChange={handleFile}
            hidden
          />

          <button
            type="button"
            className="editor-more-button"
            title="More editor actions"
            aria-label="More editor actions"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal size={17} />
          </button>

          {menuOpen && (
            <div className="editor-more-menu" ref={menuRef} role="menu" aria-label="Editor actions">
              <button type="button" role="menuitem" onClick={() => { onCopy(); setMenuOpen(false); }}>
                {codeCopied ? <Check size={14} /> : <Copy size={14} />}
                {codeCopied ? "Copied" : "Copy code"}
              </button>
              <button type="button" role="menuitem" disabled={isAnalyzing} onClick={() => { reset(); setMenuOpen(false); }}>
                <RotateCcw size={14} /> Reset code
              </button>
              <button type="button" role="menuitem" disabled={!findings.length} onClick={() => { onExport(); setMenuOpen(false); }}>
                <Download size={14} /> Export report
              </button>
              <button type="button" role="menuitem" onClick={() => { fileInputRef.current?.click(); setMenuOpen(false); }}>
                <Upload size={14} /> Open file
              </button>
            </div>
          )}

          <button
            type="button"
            className="primary-button review-code-button toolbar-analyze"
            onClick={handleReview}
            disabled={isAnalyzing || !code.trim()}
          >
            {isAnalyzing ? (
              <>
                <LoaderCircle
                  className="editor-loading-icon"
                  size={15}
                />
                Analyzing...
              </>
            ) : (
              <>
                <Play size={15} />
                {analysisComplete ? "Re-analyze" : "Analyze code"}
              </>
            )}
          </button>
        </div>
      </div>

      {localError && (
        <div className="error-message editor-error" role="alert">
          {localError}
        </div>
      )}

      <div
        className={`code-editor-frame ${
          isAnalyzing ? "scanning" : ""
        }`}
      >
        <div className="code-line-numbers" ref={lineNumbersRef} aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => {
            const line = index + 1;
            const finding = lineFinding(line);
            const selected = finding?.id === selectedFinding;
            const severity = String(finding?.severity || "").toLowerCase();

            return (
              <div
                key={line}
                className={`${finding ? `annotated-line ${severity}` : ""} ${
                  selected ? "selected" : ""
                }`}
                title={finding?.title || ""}
              >
                {finding
                  ? severity.includes("high") ||
                    severity.includes("error") ||
                    severity.includes("critical")
                    ? "! "
                    : "• "
                  : ""}
                {line}
              </div>
            );
          })}
        </div>

        <pre
          className="code-highlight-layer"
          ref={highlightRef}
          aria-hidden="true"
        >
          {code.split("\n").map(renderHighlightedLine)}
        </pre>

        <textarea
          ref={editorRef}
          className="code-editor code-editor-input"
          value={code}
          onScroll={syncScroll}
          onChange={(event) => {
            syncCode(event.target.value);
            setLocalError("");
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="Source code editor"
          placeholder="Paste your code here..."
          disabled={isAnalyzing}
          wrap="off"
          onKeyDown={handleEditorKeyDown}
        />
      </div>

      <div className="editor-footer">
        <div className="editor-status">
          <span className="status-dot" />
          <span>{lineCount} lines</span>
          <span>·</span>
          <span>{code.length} characters</span>
          <span>·</span>
          <span>{keymap === "vim" ? `Vim ${vimMode}` : keymap === "emacs" ? "Emacs keys" : "VS Code keys"}</span>

          {analysisComplete && (
            <span className="analyzed-time">
              Analyzed{" "}
              {lastReviewDate
                ? `${elapsedSeconds}s ago`
                : "just now"}
            </span>
          )}
        </div>
      </div>

      <div className="editor-action-bar" aria-label="Code actions">
        <button
          type="button"
          className="secondary-button editor-action-button"
          onClick={onCorrectCode ?? handleReview}
          disabled={isAnalyzing || !code.trim()}
          title="Review the code and show suggested corrections"
        >
          {isCorrecting ? (
            <>
              <LoaderCircle className="editor-loading-icon" size={15} />
              Correcting...
            </>
          ) : "Correct Code"}
        </button>
        <button
          type="button"
          className="primary-button editor-action-button"
          onClick={onTestCode ?? handleReview}
          disabled={isAnalyzing || !code.trim()}
          title="Run code analysis to check for issues"
        >
          {isAnalyzing ? "Testing..." : "Test Code"}
        </button>
      </div>
    </section>
  );
}
