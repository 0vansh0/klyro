import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Flame,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

const COMPLETED_LESSONS_KEY = "codesentinel-completed-lessons";
const HUB_STORAGE_PREFIX = "codesentinel-learning-hub-v1";

const lessons = [
  { id: "undefined", title: "Track variables and scope", path: "JavaScript", level: "Beginner", minutes: 4, topic: "variables", summary: "Declare values before using them and trace which scope owns each name.", sample: "console.log(userName);", takeaway: "Check spelling, declaration order, and scope when a name is not recognized." },
  { id: "functions", title: "Write predictable functions", path: "JavaScript", level: "Beginner", minutes: 5, topic: "functions", summary: "Keep functions focused, return the value callers expect, and make inputs explicit.", sample: "function add(a, b) { return a + b; }", takeaway: "A clear input and return value make behavior easier to test." },
  { id: "arrays", title: "Handle empty collections", path: "JavaScript", level: "Beginner", minutes: 5, topic: "arrays", summary: "Check collection boundaries before reading or reducing values.", sample: "const average = values.length ? total / values.length : 0;", takeaway: "Empty arrays are normal inputs; decide their behavior deliberately." },
  { id: "errors", title: "Handle errors intentionally", path: "JavaScript", level: "Beginner", minutes: 5, topic: "errors", summary: "Handle expected failures without hiding errors or leaving state inconsistent.", sample: "try { await loadData(); } catch (error) { showMessage(error); }", takeaway: "Give users useful feedback and preserve enough detail to debug safely." },
  { id: "async", title: "Understand async flows", path: "JavaScript", level: "Intermediate", minutes: 7, topic: "async", summary: "Await asynchronous work and represent loading, success, and failure states.", sample: "const response = await fetch(url);\nif (!response.ok) throw new Error('Request failed');", takeaway: "Handle both network errors and unsuccessful HTTP responses." },
  { id: "react-state", title: "Keep React state predictable", path: "React", level: "Intermediate", minutes: 6, topic: "react", summary: "Update state immutably and derive display values from the source state.", sample: "setItems((items) => [...items, nextItem]);", takeaway: "State updates should describe the next state without mutating the current one." },
  { id: "injection", title: "Prevent injection vulnerabilities", path: "Security", level: "Intermediate", minutes: 7, topic: "security", summary: "Do not concatenate untrusted input into database queries or commands.", sample: "db.users.find({ email: submittedEmail });", takeaway: "Use parameterized queries and safe APIs for external input." },
  { id: "secrets", title: "Protect API keys and secrets", path: "Security", level: "Beginner", minutes: 6, topic: "security", summary: "Keep private credentials on the server and rotate exposed keys.", sample: "const apiKey = import.meta.env.VITE_PRIVATE_KEY;", takeaway: "Anything shipped to a browser is visible to users; private keys belong on the server." },
  { id: "html-a11y", title: "Build accessible HTML", path: "HTML", level: "Beginner", minutes: 5, topic: "html", summary: "Use semantic elements, labels, and descriptive alternatives for meaningful images.", sample: "<img src=\"logo.png\" alt=\"KLYRO\" />", takeaway: "Accessible markup gives assistive technology the information visual users receive." },
  { id: "testing", title: "Test behavior, not implementation", path: "Testing", level: "Intermediate", minutes: 8, topic: "testing", summary: "Choose cases that cover expected behavior, edge cases, and failures.", sample: "assert.equal(formatName('  sam '), 'Sam');", takeaway: "Tests are strongest when they verify observable outcomes." },
];

const roadmaps = [
  { id: "javascript", title: "JavaScript foundations", subtitle: "Beginner → confident JavaScript", steps: ["undefined", "functions", "arrays", "errors", "async"] },
  { id: "react", title: "Frontend with React", subtitle: "HTML → state → tested UI", steps: ["html-a11y", "react-state", "async", "testing"] },
  { id: "fullstack", title: "Secure full-stack basics", subtitle: "Build safer browser-to-server flows", steps: ["functions", "async", "injection", "secrets", "testing"] },
];

const challenges = [
  { id: "truthy-empty-array", topic: "JavaScript basics", title: "The empty array check", level: "Beginner", prompt: "What does this condition do in JavaScript?", code: "if ([]) {\n  console.log('has items');\n}", options: ["It logs because arrays are truthy, even when empty.", "It does not log because the array has no items.", "It throws because an array cannot be a condition."], answer: 0, hints: ["JavaScript converts objects to booleans in conditions.", "An empty array is still an object value."], explanation: "Arrays are truthy in JavaScript, including empty arrays. Check `items.length > 0` when you need to know whether one has elements." },
  { id: "missing-return", topic: "Functions", title: "The missing return", level: "Beginner", prompt: "Why does `double(4)` produce `undefined`?", code: "function double(value) {\n  value * 2;\n}", options: ["The function needs an explicit `return`.", "Numbers cannot be multiplied inside functions.", "The parameter must be named `number`."], answer: 0, hints: ["An expression by itself does not become a function's result.", "What keyword sends a value back to the caller?"], explanation: "A function returns `undefined` unless it reaches a `return` statement (or uses an expression body arrow function). Write `return value * 2;`." },
  { id: "strict-equality", topic: "JavaScript basics", title: "Compare without coercion", level: "Beginner", prompt: "Which check avoids JavaScript's automatic type conversion?", code: "7 == '7';", options: ["`7 == '7'`", "`7 === '7'`", "`Boolean(7) === Boolean('7')`"], answer: 1, hints: ["One equality operator checks both type and value.", "It uses three equals signs."], explanation: "Strict equality (`===`) compares without converting the operands to a shared type, so `7 === '7'` is false." },
  { id: "html-alt", topic: "HTML accessibility", title: "Describe the image", level: "Beginner", prompt: "What should a meaningful logo image include?", code: "<img src=\"logo.png\">", options: ["A descriptive `alt` attribute.", "A `target` attribute.", "A button nested inside the image."], answer: 0, hints: ["Screen readers need text when an image conveys meaning.", "The attribute is short for alternative text."], explanation: "Add an `alt` attribute such as `alt=\"KLYRO\"`. For purely decorative images, use an empty `alt=\"\"`." },
  { id: "empty-average", topic: "Edge cases", title: "Average of nothing", level: "Intermediate", prompt: "What should a robust average function do for an empty list?", code: "function average(values) {\n  return values.reduce((sum, n) => sum + n, 0) / values.length;\n}", options: ["Return a deliberate fallback or report invalid input.", "Divide by zero and hope the caller handles it.", "Return the first item."], answer: 0, hints: ["An empty list has length zero.", "Decide what the API promises for this boundary case."], explanation: "The function should explicitly define empty-input behavior, such as returning `null`, returning a documented fallback, or throwing a clear error." },
  { id: "async-response", topic: "Async JavaScript", title: "Check the HTTP response", level: "Intermediate", prompt: "What check catches an HTTP 404 after `fetch` resolves?", code: "const response = await fetch(url);", options: ["`if (!response.ok) throw new Error(...)`", "`if (response === false) ...`", "No check is needed; fetch rejects for every 404."], answer: 0, hints: ["A 404 is still a completed HTTP response.", "The response exposes a boolean for 2xx statuses."], explanation: "`fetch` generally resolves for HTTP error statuses. Check `response.ok` and handle non-2xx results explicitly." },
  { id: "safe-query", topic: "Security", title: "Keep query input safe", level: "Intermediate", prompt: "Which approach is safer for a user-provided email?", code: "// Find an account by the submitted email", options: ["Concatenate it into a SQL string.", "Pass it as a parameter to a prepared query.", "Remove spaces and concatenate it."], answer: 1, hints: ["Input can contain syntax that changes a query.", "Let the database distinguish data from query instructions."], explanation: "Prepared statements or parameterized database APIs keep user input separate from executable query text." },
];

const interviews = [
  { id: "js-equality", title: "When would you use `===` instead of `==`?", difficulty: "Beginner", category: "JavaScript", hints: ["Think about implicit type conversion.", "Mention predictable comparisons across values of different types."], answer: "Use `===` for a comparison that checks both type and value without coercion. Use loose equality only when its conversion behavior is intentional and well understood.", keywords: ["type", "coerc", "value"] },
  { id: "react-state", title: "Why should React state updates avoid mutation?", difficulty: "Intermediate", category: "React", hints: ["Consider how React notices a value changed.", "Think about old renders and predictable updates."], answer: "Immutable updates create a new reference, which helps React detect changes and keeps prior render state predictable. Use functional updates when the next value depends on the previous value.", keywords: ["new", "reference", "predict", "previous"] },
  { id: "api-errors", title: "How would you handle a failed API request in a UI?", difficulty: "Intermediate", category: "Frontend", hints: ["Network failure and HTTP error are different cases.", "Think about loading, success, and error states."], answer: "Represent loading, success, and error states; catch network failures, check `response.ok` for HTTP errors, show actionable feedback, and allow a retry where appropriate.", keywords: ["loading", "error", "response.ok", "retry"] },
  { id: "sql-injection", title: "How do prepared statements prevent SQL injection?", difficulty: "Intermediate", category: "Security", hints: ["Separate query structure from user-supplied values.", "Mention how the database receives parameters."], answer: "Prepared statements define the SQL structure separately from values. The database treats user input as data, so characters inside it cannot change the query's intended structure.", keywords: ["parameter", "data", "query"] },
  { id: "empty-input", title: "How do you make a function robust for edge cases?", difficulty: "Beginner", category: "Problem solving", hints: ["Start by naming boundary values.", "Explain the expected behavior before implementing it."], answer: "Identify boundaries such as empty input, null values, and limits; decide and document their behavior; then add tests for those cases and the normal path.", keywords: ["empty", "boundary", "test", "behavior"] },
];

const tabs = [
  { id: "mentor", label: "AI Mentor", icon: BrainCircuit },
  { id: "mistakes", label: "My Mistakes", icon: Target },
  { id: "challenge", label: "Daily Challenge", icon: Flame },
  { id: "roadmaps", label: "Roadmaps", icon: Route },
  { id: "interview", label: "Interview Practice", icon: BriefcaseBusiness },
  { id: "recommendations", label: "For You", icon: Sparkles },
  { id: "achievements", label: "Achievements", icon: Award },
];

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function loadHubState(key) {
  const saved = readJson(key, {});
  return {
    challengeDays: saved.challengeDays && typeof saved.challengeDays === "object" ? saved.challengeDays : {},
    missCounts: saved.missCounts && typeof saved.missCounts === "object" ? saved.missCounts : {},
    mentorMessages: Array.isArray(saved.mentorMessages) ? saved.mentorMessages.slice(-24) : [],
    mentorQuestions: Number(saved.mentorQuestions) || 0,
    completedInterviews: Array.isArray(saved.completedInterviews) ? saved.completedInterviews : [],
    interviewHints: saved.interviewHints && typeof saved.interviewHints === "object" ? saved.interviewHints : {},
    roadmapId: typeof saved.roadmapId === "string" ? saved.roadmapId : "javascript",
  };
}

function loadCompletedLessons() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(COMPLETED_LESSONS_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((id) => lessons.some((lesson) => lesson.id === id)) : [];
  } catch {
    return [];
  }
}

function getMistakes(reviews) {
  const grouped = new Map();
  for (const review of reviews) {
    for (const finding of review.findings || []) {
      const message = finding.message || finding.title || finding.summary || "Review this finding";
      const ruleId = finding.ruleId || finding.type || finding.source || message.split(/[.:]/, 1)[0];
      if (!ruleId || ruleId === "Clean result") continue;
      const key = String(ruleId).toLowerCase();
      const current = grouped.get(key) || { key, label: String(ruleId), message: String(message), count: 0, languages: new Set(), latest: review.date };
      current.count += 1;
      if (review.language) current.languages.add(review.language);
      if (!current.latest || new Date(review.date) > new Date(current.latest)) current.latest = review.date;
      grouped.set(key, current);
    }
  }
  return [...grouped.values()].map((item) => ({ ...item, languages: [...item.languages] })).sort((a, b) => b.count - a.count || new Date(b.latest) - new Date(a.latest));
}

function getBugFixCount(reviews) {
  const grouped = new Map();
  for (const review of reviews) {
    const file = review.fileId || review.fileName;
    if (!file) continue;
    const items = grouped.get(file) || [];
    items.push({ date: new Date(review.date || 0).getTime(), count: Number.isFinite(Number(review.issueCount)) ? Number(review.issueCount) : (review.findings || []).length });
    grouped.set(file, items);
  }
  let improvements = 0;
  for (const items of grouped.values()) {
    items.sort((a, b) => a.date - b.date);
    for (let index = 1; index < items.length; index += 1) {
      if (items[index].count < items[index - 1].count) improvements += items[index - 1].count - items[index].count;
    }
  }
  return improvements;
}

function lessonForMistake(mistake) {
  const key = mistake.key;
  if (/undef|unused|variable|no-undef|no-unused/.test(key)) return "undefined";
  if (/eqeq|equality/.test(key)) return "arrays";
  if (/security|injection|sql/.test(key)) return "injection";
  if (/html|accessibility|alt/.test(key)) return "html-a11y";
  if (/promise|async|await/.test(key)) return "async";
  if (/error|exception/.test(key)) return "errors";
  if (/react|jsx|hook/.test(key)) return "react-state";
  return null;
}

function scoreAnswer(answer, keywords) {
  const normalized = answer.toLowerCase();
  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase())).length;
}

export default function LearningHub({ apiBaseUrl = "/api", reviewHistory = [], user = null }) {
  const scopedKey = `${HUB_STORAGE_PREFIX}:${user?.id || "guest"}`;
  const [hubState, setHubState] = useState(() => loadHubState(scopedKey));
  const [completedLessons, setCompletedLessons] = useState(loadCompletedLessons);
  const [activeTab, setActiveTab] = useState("mentor");
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [mentorText, setMentorText] = useState("");
  const [mentorError, setMentorError] = useState("");
  const [mentorBusy, setMentorBusy] = useState(false);
  const [mentorFocus, setMentorFocus] = useState(null);
  const [expandedMistake, setExpandedMistake] = useState(null);
  const [interviewId, setInterviewId] = useState(interviews[0].id);
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [interviewFeedback, setInterviewFeedback] = useState("");
  const [difficulty, setDifficulty] = useState("All");

  useEffect(() => {
    try { window.localStorage.setItem(scopedKey, JSON.stringify(hubState)); } catch { /* Continue in memory when storage is unavailable. */ }
  }, [hubState, scopedKey]);

  useEffect(() => {
    try { window.localStorage.setItem(COMPLETED_LESSONS_KEY, JSON.stringify(completedLessons)); } catch { /* Continue in memory when storage is unavailable. */ }
  }, [completedLessons]);

  const mistakes = useMemo(() => getMistakes(reviewHistory), [reviewHistory]);
  const bugFixCount = useMemo(() => getBugFixCount(reviewHistory), [reviewHistory]);
  const today = dayKey();
  const challenge = challenges[Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000) % challenges.length];
  const todayChallenge = hubState.challengeDays[today] || { attempts: 0, hintsShown: 0, solved: false, selectedAnswer: null };
  const interviewList = difficulty === "All" ? interviews : interviews.filter((item) => item.difficulty === difficulty);
  const currentInterview = interviewList.find((item) => item.id === interviewId) || interviewList[0];
  const solvedChallengeCount = Object.values(hubState.challengeDays).filter((item) => item?.solved).length;
  const currentChallengeAnswer = selectedAnswer ?? todayChallenge.selectedAnswer;

  const recommendations = useMemo(() => {
    const results = [];
    for (const mistake of mistakes.slice(0, 4)) {
      const id = lessonForMistake(mistake);
      const lesson = lessons.find((item) => item.id === id && !completedLessons.includes(id));
      if (lesson && !results.some((item) => item.lesson.id === lesson.id)) results.push({ lesson, reason: `Seen ${mistake.count} time${mistake.count === 1 ? "" : "s"} in your reviews: ${mistake.message}` });
    }
    const mostMissedTopic = Object.entries(hubState.missCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (mostMissedTopic) {
      const matchingChallenge = challenges.find((item) => item.topic === mostMissedTopic);
      const lesson = lessons.find((item) => item.topic.toLowerCase().includes(mostMissedTopic.split(" ")[0].toLowerCase()) && !completedLessons.includes(item.id));
      if (lesson && !results.some((item) => item.lesson.id === lesson.id)) results.push({ lesson, reason: `You missed ${hubState.missCounts[mostMissedTopic]} ${mostMissedTopic} challenge answer${hubState.missCounts[mostMissedTopic] === 1 ? "" : "s"}.` });
      else if (matchingChallenge && !todayChallenge.solved) results.push({ challenge: matchingChallenge, reason: `Practice the ${mostMissedTopic} topic you found tricky.` });
    }
    if (results.length < 3) {
      for (const lesson of lessons) {
        if (results.length >= 3) break;
        if (!completedLessons.includes(lesson.id) && !results.some((item) => item.lesson?.id === lesson.id)) results.push({ lesson, reason: "Continue your learning path." });
      }
    }
    return results.slice(0, 3);
  }, [mistakes, completedLessons, hubState.missCounts, todayChallenge.solved]);

  const achievements = [
    { id: "first-lesson", title: "First Steps", detail: "Complete your first lesson", icon: BookOpen, earned: completedLessons.length >= 1 },
    { id: "bug-fixer", title: "Bug Fixer", detail: "A later review has fewer findings in the same file", icon: ShieldCheck, earned: bugFixCount > 0 },
    { id: "challenge", title: "Daily Debugger", detail: "Solve a daily challenge", icon: Flame, earned: solvedChallengeCount >= 1 },
    { id: "streak", title: "Practice Habit", detail: "Solve challenges on three different days", icon: Trophy, earned: solvedChallengeCount >= 3 },
    { id: "interview", title: "Interview Ready", detail: "Practice three interview questions", icon: BriefcaseBusiness, earned: hubState.completedInterviews.length >= 3 },
    { id: "mentor", title: "Curious Mind", detail: "Ask the AI Mentor a question", icon: BrainCircuit, earned: hubState.mentorQuestions >= 1 },
    { id: "roadmap", title: "Path Finder", detail: "Complete a roadmap step", icon: Route, earned: completedLessons.some((id) => roadmaps.some((item) => item.steps.includes(id))) },
  ];

  function updateChallenge(updater) {
    setHubState((previous) => {
      const current = previous.challengeDays[today] || { attempts: 0, hintsShown: 0, solved: false, selectedAnswer: null };
      return { ...previous, challengeDays: { ...previous.challengeDays, [today]: updater(current) } };
    });
  }

  function chooseChallengeAnswer(index) {
    setSelectedAnswer(index);
    updateChallenge((current) => ({ ...current, selectedAnswer: index }));
  }

  function submitChallenge() {
    if (currentChallengeAnswer === null || todayChallenge.solved) return;
    const correct = currentChallengeAnswer === challenge.answer;
    updateChallenge((current) => ({ ...current, attempts: current.attempts + 1, selectedAnswer: currentChallengeAnswer, solved: correct }));
    if (!correct) setHubState((previous) => ({ ...previous, missCounts: { ...previous.missCounts, [challenge.topic]: (previous.missCounts[challenge.topic] || 0) + 1 } }));
  }

  function showChallengeHint() {
    if (todayChallenge.hintsShown >= challenge.hints.length || todayChallenge.solved) return;
    updateChallenge((current) => ({ ...current, hintsShown: Math.min(current.hintsShown + 1, challenge.hints.length) }));
  }

  function toggleLesson(id) {
    setCompletedLessons((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  }

  function askAbout(topic, finding = "") {
    setMentorFocus({ topic, finding });
    setMentorError("");
    setMentorText(finding ? `Can you explain this issue in simple terms and how I can avoid it?` : `Can you explain ${topic} with a simple example?`);
    setActiveTab("mentor");
  }

  async function sendMentorMessage(event) {
    event.preventDefault();
    const question = mentorText.trim();
    if (!question || mentorBusy) return;
    setMentorBusy(true);
    setMentorError("");
    setHubState((previous) => ({ ...previous, mentorMessages: [...previous.mentorMessages, { role: "user", text: question }].slice(-24) }));
    setMentorText("");
    try {
      const history = hubState.mentorMessages.slice(-10).map(({ role, text }) => ({ role, text }));
      const response = await fetch(`${apiBaseUrl}/mentor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: question, history, context: { topic: mentorFocus?.topic || "Programming", language: mentorFocus?.language || "", finding: mentorFocus?.finding || "" } }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "AI Mentor could not answer right now.");
      setHubState((previous) => ({ ...previous, mentorMessages: [...previous.mentorMessages, { role: "model", text: result.answer }].slice(-24), mentorQuestions: previous.mentorQuestions + 1 }));
    } catch (error) {
      setMentorError(error.message || "Could not reach AI Mentor. Try a lesson or challenge while it is unavailable.");
    } finally {
      setMentorBusy(false);
    }
  }

  function showInterviewHint() {
    setHubState((previous) => ({ ...previous, interviewHints: { ...previous.interviewHints, [currentInterview.id]: Math.min((previous.interviewHints[currentInterview.id] || 0) + 1, currentInterview.hints.length) } }));
  }

  function checkInterviewAnswer() {
    if (interviewAnswer.trim().length < 15) {
      setInterviewFeedback("Add a little more detail before comparing your answer.");
      return;
    }
    const matches = scoreAnswer(interviewAnswer, currentInterview.keywords);
    setInterviewFeedback(matches >= 2 ? "Good coverage. Compare your explanation with the sample answer below." : "You have a starting point. Look for the key ideas in the hints, then compare with the sample answer.");
  }

  function markInterviewPracticed() {
    setHubState((previous) => ({ ...previous, completedInterviews: previous.completedInterviews.includes(currentInterview.id) ? previous.completedInterviews : [...previous.completedInterviews, currentInterview.id] }));
    setInterviewFeedback("Question marked as practiced. Try explaining it again without looking at the sample.");
  }

  function selectInterview(id) {
    setInterviewId(id);
    setInterviewAnswer("");
    setInterviewFeedback("");
  }

  const selectedRoadmap = roadmaps.find((item) => item.id === hubState.roadmapId) || roadmaps[0];
  const completedForRoadmap = selectedRoadmap.steps.filter((id) => completedLessons.includes(id)).length;
  const currentDateLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`));

  return (
    <section className="learning-hub-featured">
      <header className="learning-hub-hero">
        <div>
          <div className="learning-hub-eyebrow"><Sparkles size={14} /> YOUR PERSONAL PRACTICE SPACE</div>
          <h1>Learning Hub</h1>
          <p>Turn code reviews into small, focused steps toward stronger coding habits.</p>
        </div>
        <div className="learning-hub-summary">
          <div><BookOpen size={17} /><strong>{completedLessons.length}</strong><span>lessons</span></div>
          <div><Flame size={17} /><strong>{solvedChallengeCount}</strong><span>challenges</span></div>
          <div><Award size={17} /><strong>{achievements.filter((item) => item.earned).length}</strong><span>badges</span></div>
        </div>
      </header>

      <nav className="learning-hub-tabs" aria-label="Learning features">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)} aria-pressed={activeTab === id}>
            <Icon size={16} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {activeTab === "mentor" && (
        <div className="learning-feature-grid">
          <section className="learning-feature-card mentor-card">
            <div className="learning-feature-heading"><div className="learning-feature-icon"><BrainCircuit size={19} /></div><div><h2>AI Mentor</h2><p>Ask follow-ups about a concept or review finding. Replies use your server's Gemini setup.</p></div></div>
            {mentorFocus && <div className="mentor-context"><strong>Current focus</strong><span>{mentorFocus.topic}{mentorFocus.finding ? ` · ${mentorFocus.finding}` : ""}</span><button type="button" onClick={() => setMentorFocus(null)}>Clear</button></div>}
            <div className="mentor-chat" aria-live="polite">
              {hubState.mentorMessages.length === 0 && <div className="mentor-empty"><MessageCircle size={22} /><p>Try asking “Why does this happen?” or “Can you show a simpler example?”</p></div>}
              {hubState.mentorMessages.map((message, index) => <article key={`${index}-${message.role}`} className={`mentor-message ${message.role}`}><strong>{message.role === "user" ? "You" : "KLYRO Mentor"}</strong><p>{message.text}</p></article>)}
              {mentorBusy && <div className="mentor-thinking"><LoaderCircle size={15} className="learning-spin" /> Thinking through your question…</div>}
            </div>
            {mentorError && <p className="learning-inline-error" role="alert">{mentorError}</p>}
            <form className="mentor-form" onSubmit={sendMentorMessage}>
              <textarea value={mentorText} onChange={(event) => setMentorText(event.target.value)} maxLength={1500} rows={3} placeholder="Ask a coding question…" aria-label="Ask AI Mentor" />
              <div><span>{mentorText.length}/1500 · Chat is saved in this browser</span><button type="submit" disabled={mentorBusy || !mentorText.trim()}><Send size={15} /> Ask Mentor</button></div>
            </form>
            <div className="mentor-suggestions"><button type="button" onClick={() => setMentorText("Explain closures using a simple everyday example.")}>Explain a concept</button><button type="button" onClick={() => setMentorText("How should I debug a problem when I do not know where to start?")}>Help me debug</button></div>
          </section>
          <aside className="learning-side-stack">
            <section className="learning-feature-card learning-quick-card"><div className="learning-feature-heading"><div className="learning-feature-icon amber"><Lightbulb size={18} /></div><div><h3>Need a starting point?</h3><p>Use a progressive hint before viewing the explanation.</p></div></div><button type="button" className="learning-secondary-action" onClick={() => setActiveTab("challenge")}>Try today's challenge <ChevronRight size={15} /></button></section>
            <section className="learning-feature-card learning-quick-card"><div className="learning-feature-heading"><div className="learning-feature-icon green"><Target size={18} /></div><div><h3>Review patterns</h3><p>{mistakes.length ? `${mistakes.length} recurring analyzer patterns found in ${reviewHistory.length} reviews.` : "Your review patterns will appear here after you analyze code."}</p></div></div><button type="button" className="learning-secondary-action" onClick={() => setActiveTab("mistakes")}>Explore my mistakes <ChevronRight size={15} /></button></section>
          </aside>
        </div>
      )}

      {activeTab === "mistakes" && (
        <section className="learning-feature-card">
          <div className="learning-section-title"><div><div className="learning-feature-eyebrow">LEARN FROM YOUR OWN REVIEWS</div><h2>My Mistakes</h2><p>Recurring findings are grouped from your saved review history in this browser or account.</p></div><span className="learning-count-pill">{mistakes.length} patterns</span></div>
          {mistakes.length === 0 ? <div className="learning-empty-state"><Target size={24} /><h3>No review patterns yet</h3><p>Run a code review and findings will be summarized here automatically.</p></div> : <div className="mistake-list">{mistakes.map((mistake) => {
            const lessonId = lessonForMistake(mistake);
            const lesson = lessons.find((item) => item.id === lessonId);
            const expanded = expandedMistake === mistake.key;
            return <article className={`mistake-item ${expanded ? "expanded" : ""}`} key={mistake.key}><button type="button" className="mistake-summary" onClick={() => setExpandedMistake(expanded ? null : mistake.key)} aria-expanded={expanded}><div className="mistake-count">{mistake.count}</div><div><strong>{mistake.label}</strong><p>{mistake.message}</p><span>{mistake.languages.length ? mistake.languages.join(", ") : "Multiple reviews"} · last seen {mistake.latest ? new Date(mistake.latest).toLocaleDateString() : "recently"}</span></div>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>{expanded && <div className="mistake-detail"><p>This pattern appeared {mistake.count} time{mistake.count === 1 ? "" : "s"}. Read the matching lesson and try explaining the fix in your own words.</p><div><button type="button" onClick={() => askAbout(mistake.label, mistake.message)}><BrainCircuit size={14} /> Ask Mentor</button>{lesson && <button type="button" onClick={() => { setActiveTab("roadmaps"); setExpandedLesson(lesson.id); }}><BookOpen size={14} /> Study {lesson.title}</button>}</div></div>}</article>;
          })}</div>}
          <p className="learning-data-note">Only analyzer findings are summarized. Your submitted source is not sent to AI Mentor unless you ask a question; the mentor receives only the finding text you select.</p>
        </section>
      )}

      {activeTab === "challenge" && (
        <div className="learning-feature-grid challenge-grid">
          <section className="learning-feature-card challenge-card">
            <div className="challenge-topline"><span><Flame size={15} /> DAILY CHALLENGE</span><span><Clock3 size={14} /> {currentDateLabel}</span></div>
            <div className="learning-feature-eyebrow">{challenge.level} · {challenge.topic}</div><h2>{challenge.title}</h2><p>{challenge.prompt}</p>
            <pre className="learning-challenge-code"><code>{challenge.code}</code></pre>
            <div className="challenge-options" role="radiogroup" aria-label="Choose your answer">{challenge.options.map((option, index) => <button key={option} type="button" role="radio" aria-checked={currentChallengeAnswer === index} className={currentChallengeAnswer === index ? "selected" : ""} disabled={todayChallenge.solved} onClick={() => chooseChallengeAnswer(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>
            <div className="challenge-actions"><button type="button" className="learning-secondary-action" onClick={showChallengeHint} disabled={todayChallenge.solved || todayChallenge.hintsShown >= challenge.hints.length}><Lightbulb size={15} /> {todayChallenge.hintsShown >= challenge.hints.length ? "All hints shown" : `Show hint ${todayChallenge.hintsShown + 1}`}</button><button type="button" className="learning-primary-action" onClick={submitChallenge} disabled={todayChallenge.solved || currentChallengeAnswer === null}>Check answer <Check size={15} /></button></div>
            {challenge.hints.slice(0, todayChallenge.hintsShown).map((hint, index) => <div className="challenge-hint" key={`${challenge.id}-hint-${index}`}><Lightbulb size={15} /><span><strong>Hint {index + 1}.</strong> {hint}</span></div>)}
            {todayChallenge.attempts > 0 && <div className={`challenge-feedback ${todayChallenge.solved ? "correct" : "try-again"}`} role="status">{todayChallenge.solved ? <><CheckCircle2 size={17} /><div><strong>Correct — challenge complete!</strong><p>{challenge.explanation}</p></div></> : <><CircleHelp size={17} /><div><strong>Not quite yet.</strong><p>Try another answer or reveal the next hint. Attempt {todayChallenge.attempts}.</p></div></>}</div>}
          </section>
          <aside className="learning-side-stack"><section className="learning-feature-card learning-quick-card"><div className="learning-feature-heading"><div className="learning-feature-icon amber"><Lightbulb size={18} /></div><div><h3>Hints are progressive</h3><p>Each hint adds one clue. The explanation appears only after you solve it.</p></div></div></section><section className="learning-feature-card learning-quick-card"><div className="learning-feature-heading"><div className="learning-feature-icon green"><Trophy size={18} /></div><div><h3>Your practice record</h3><p>{solvedChallengeCount} challenges solved. Progress is saved on this device.</p></div></div><button type="button" className="learning-secondary-action" onClick={() => setActiveTab("achievements")}>View badges <ChevronRight size={15} /></button></section></aside>
        </div>
      )}

      {activeTab === "roadmaps" && (
        <div className="learning-feature-grid roadmap-grid">
          <div className="learning-roadmap-list">{roadmaps.map((roadmap) => { const completeCount = roadmap.steps.filter((id) => completedLessons.includes(id)).length; const selected = roadmap.id === selectedRoadmap.id; return <button type="button" key={roadmap.id} className={`roadmap-choice ${selected ? "selected" : ""}`} onClick={() => setHubState((previous) => ({ ...previous, roadmapId: roadmap.id }))}><span className="roadmap-choice-icon"><Route size={17} /></span><span><strong>{roadmap.title}</strong><small>{roadmap.subtitle}</small><span className="roadmap-mini-progress"><i style={{ width: `${Math.round((completeCount / roadmap.steps.length) * 100)}%` }} /></span></span><b>{completeCount}/{roadmap.steps.length}</b></button>; })}</div>
          <section className="learning-feature-card roadmap-detail"><div className="learning-section-title"><div><div className="learning-feature-eyebrow">GUIDED LEARNING PATH</div><h2>{selectedRoadmap.title}</h2><p>{selectedRoadmap.subtitle}</p></div><span className="learning-count-pill">{completedForRoadmap}/{selectedRoadmap.steps.length} steps</span></div><div className="roadmap-steps">{selectedRoadmap.steps.map((id, index) => { const lesson = lessons.find((item) => item.id === id); const done = completedLessons.includes(id); const expanded = expandedLesson === id; return <article className={`roadmap-step ${done ? "complete" : ""} ${expanded ? "expanded" : ""}`} key={id}><button type="button" className="roadmap-step-main" onClick={() => setExpandedLesson(expanded ? null : id)} aria-expanded={expanded}><span className="roadmap-step-number">{done ? <Check size={14} /> : index + 1}</span><span><strong>{lesson.title}</strong><small>{lesson.level} · {lesson.minutes} min · {lesson.path}</small></span><ChevronDown size={15} /></button>{expanded && <div className="roadmap-step-detail"><p>{lesson.summary}</p><div className="learning-example-label"><Code2 size={13} /> Try this</div><pre className="learning-challenge-code"><code>{lesson.sample}</code></pre><p className="lesson-takeaway-inline"><Lightbulb size={14} /> {lesson.takeaway}</p><button type="button" className={`learning-primary-action ${done ? "subtle" : ""}`} onClick={() => toggleLesson(id)}>{done ? "Completed · mark incomplete" : "Mark lesson complete"}<CheckCircle2 size={14} /></button></div>}</article>; })}</div></section>
        </div>
      )}

      {activeTab === "interview" && (
        <div className="learning-feature-grid interview-grid">
          <section className="learning-feature-card interview-question-card"><div className="learning-section-title"><div><div className="learning-feature-eyebrow">THINK IT THROUGH BEFORE REVEALING</div><h2>Interview Practice</h2><p>Answer in your own words, reveal progressive hints, then compare with an explanation.</p></div></div><label className="interview-filter"><span>Difficulty</span><select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>All</option><option>Beginner</option><option>Intermediate</option></select></label><div className="interview-question-list">{interviewList.map((item) => <button key={item.id} type="button" className={item.id === currentInterview.id ? "selected" : ""} onClick={() => selectInterview(item.id)}><span><strong>{item.title}</strong><small>{item.category} · {item.difficulty}</small></span>{hubState.completedInterviews.includes(item.id) && <CheckCircle2 size={16} />}</button>)}</div></section>
          <section className="learning-feature-card interview-answer-card"><div className="learning-feature-eyebrow">{currentInterview.category.toUpperCase()} · {currentInterview.difficulty.toUpperCase()}</div><h2>{currentInterview.title}</h2><label className="interview-answer-label" htmlFor="interview-answer">Your answer</label><textarea id="interview-answer" value={interviewAnswer} onChange={(event) => { setInterviewAnswer(event.target.value); setInterviewFeedback(""); }} rows={6} placeholder="Explain your reasoning in your own words…"/><div className="interview-actions"><button type="button" className="learning-secondary-action" onClick={showInterviewHint} disabled={(hubState.interviewHints[currentInterview.id] || 0) >= currentInterview.hints.length}><Lightbulb size={14} /> {`Hint ${(hubState.interviewHints[currentInterview.id] || 0) + 1}`}</button><button type="button" className="learning-primary-action" onClick={checkInterviewAnswer}>Review my answer <Check size={14} /></button></div>{(hubState.interviewHints[currentInterview.id] || 0) > 0 && currentInterview.hints.slice(0, hubState.interviewHints[currentInterview.id]).map((hint, index) => <div className="challenge-hint" key={`${currentInterview.id}-hint-${index}`}><Lightbulb size={14} /><span><strong>Hint {index + 1}.</strong> {hint}</span></div>)}{interviewFeedback && <p className="interview-feedback" role="status">{interviewFeedback}</p>}<details className="interview-explanation"><summary>Reveal sample answer and explanation</summary><div><p>{currentInterview.answer}</p><button type="button" className="learning-secondary-action" onClick={markInterviewPracticed}>{hubState.completedInterviews.includes(currentInterview.id) ? "Practice again" : "Mark as practiced"}<CheckCircle2 size={14} /></button></div></details></section>
        </div>
      )}

      {activeTab === "recommendations" && (
        <section className="learning-feature-card"><div className="learning-section-title"><div><div className="learning-feature-eyebrow">BASED ON YOUR REVIEWS AND PRACTICE</div><h2>Recommended for you</h2><p>Recommendations update as your review history, challenge attempts, and lesson progress change.</p></div><Sparkles size={21} /></div>{recommendations.length === 0 ? <div className="learning-empty-state"><Sparkles size={24} /><h3>You are all caught up</h3><p>Try another challenge or review a roadmap to keep progressing.</p></div> : <div className="recommendation-list">{recommendations.map((item, index) => <article className="recommendation-item" key={item.lesson?.id || item.challenge?.id}><span className="recommendation-rank">0{index + 1}</span><div><strong>{item.lesson?.title || item.challenge?.title}</strong><p>{item.reason}</p><small>{item.lesson ? `${item.lesson.path} · ${item.lesson.level} · ${item.lesson.minutes} min` : `${item.challenge.topic} · ${item.challenge.level}`}</small></div><button type="button" onClick={() => { if (item.lesson) { setHubState((previous) => ({ ...previous, roadmapId: item.lesson.path === "React" ? "react" : item.lesson.path === "Security" ? "fullstack" : "javascript" })); setExpandedLesson(item.lesson.id); setActiveTab("roadmaps"); } else setActiveTab("challenge"); }}>{item.lesson ? "Open lesson" : "Practice"}<ChevronRight size={15} /></button></article>)}</div>}</section>
      )}

      {activeTab === "achievements" && (
        <section className="learning-feature-card"><div className="learning-section-title"><div><div className="learning-feature-eyebrow">SMALL WINS ADD UP</div><h2>Achievements</h2><p>Badges unlock from completed lessons, practice, mentor questions, and measurable review progress.</p></div><Trophy size={22} /></div><div className="achievement-grid">{achievements.map(({ id, title, detail, icon: Icon, earned }) => <article key={id} className={`achievement-card ${earned ? "earned" : "locked"}`}><div><Icon size={20} /></div><strong>{title}</strong><p>{detail}</p><span>{earned ? <><CheckCircle2 size={13} /> Earned</> : "Keep practicing"}</span></article>)}</div><div className="achievement-progress-note"><ShieldCheck size={16} /><span>{bugFixCount ? `${bugFixCount} finding${bugFixCount === 1 ? "" : "s"} disappeared across repeat reviews of the same file.` : "Run a review again after fixing findings to unlock the Bug Fixer badge."}</span></div></section>
      )}

      <footer className="learning-hub-footer"><ShieldCheck size={14} /><span>Practice progress is saved in this browser. Review-based features use only the review history available to your current profile.</span></footer>
    </section>
  );
}
