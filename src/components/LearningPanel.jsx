import { useEffect, useState } from "react";
import {
  BookOpen,
  ShieldCheck,
  Bug,
  LockKeyhole,
  Code2,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";

const STORAGE_KEY = "codesentinel-completed-lessons";

const lessons = [
  {
    id: "undefined",
    category: "JavaScript",
    title: "Avoid undefined variables",
    level: "Beginner",
    duration: "4 min",
    icon: Code2,
    color: "purple",
    description:
      "Learn how to identify variables that are used before they are declared or do not exist in the current scope.",
    example: `console.log(userName);`,
    solution: `const userName = "Alex";
console.log(userName);`,
    takeaway:
      "Declare variables before using them, and check spelling and scope when a name is not recognized.",
  },
  {
    id: "injection",
    category: "Security",
    title: "Prevent injection vulnerabilities",
    level: "Intermediate",
    duration: "7 min",
    icon: LockKeyhole,
    color: "red",
    description:
      "Understand why untrusted input should not be inserted directly into database queries or executable commands.",
    example:
      `const query = "SELECT * FROM users WHERE name = '" + name + "'";`,
    solution:
      "Use parameterized queries and safe database APIs instead of concatenating untrusted input.",
    takeaway:
      "Treat external input as untrusted and use the protections provided by your database or framework.",
  },
  {
    id: "errors",
    category: "Best Practices",
    title: "Handle errors intentionally",
    level: "Beginner",
    duration: "5 min",
    icon: Bug,
    color: "yellow",
    description:
      "Learn how to handle expected failures without hiding important errors or leaving the application in an invalid state.",
    example: `try {
  await loadData();
} catch (error) {
  console.error(error);
}`,
    solution:
      "Handle expected errors appropriately, provide useful feedback, and avoid silently swallowing failures.",
    takeaway:
      "Use clear error handling and never expose secrets or sensitive internal details in error messages.",
  },
  {
    id: "secrets",
    category: "Security",
    title: "Protect API keys and secrets",
    level: "Beginner",
    duration: "6 min",
    icon: ShieldCheck,
    color: "green",
    description:
      "Learn where credentials belong and why frontend environment variables are not a safe place for private API keys.",
    example: `const apiKey = "your-private-key";`,
    solution:
      "Keep private credentials on the server, use environment variables there, and rotate credentials that were exposed.",
    takeaway:
      "Anything shipped to the browser should be considered visible to users.",
  },
];

function getSavedLessons() {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(saved)) return [];

    return saved.filter((id) =>
      lessons.some((lesson) => lesson.id === id)
    );
  } catch {
    return [];
  }
}

export default function LearningPanel({
  compact = false,
  onOpenLearningHub = () => {},
}) {
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [completedLessons, setCompletedLessons] = useState(
    getSavedLessons
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(completedLessons)
      );
    } catch {
      // The learning panel still works if storage is unavailable.
    }
  }, [completedLessons]);

  const visibleLessons = compact ? lessons.slice(0, 3) : lessons;

  const progress = Math.round(
    (completedLessons.length / lessons.length) * 100
  );

  const toggleCompleted = (lessonId) => {
    setCompletedLessons((previous) =>
      previous.includes(lessonId)
        ? previous.filter((id) => id !== lessonId)
        : [...previous, lessonId]
    );
  };

  return (
    <section className="learning-panel-component">
      <div className="learning-panel-header">
        <div className="learning-panel-title-group">
          <div className="learning-panel-icon">
            <GraduationCap size={19} />
          </div>

          <div>
            <h2>Learning Hub</h2>
            <p>Build better and safer coding habits.</p>
          </div>
        </div>

        <button
          type="button"
          className="learning-view-all"
          onClick={() => {
            if (compact) {
              onOpenLearningHub();
              return;
            }

            const nextLesson =
              lessons.find((lesson) => !completedLessons.includes(lesson.id)) ||
              lessons[0];
            setExpandedLesson(nextLesson.id);
          }}
        >
          {compact ? "View all" : "Continue lesson"}
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="learning-progress">
        <div className="learning-progress-top">
          <span>Learning progress</span>

          <strong>
            {completedLessons.length}/{lessons.length}
          </strong>
        </div>

        <div
          className="learning-progress-track"
          role="progressbar"
          aria-label="Learning progress"
          aria-valuemin={0}
          aria-valuemax={lessons.length}
          aria-valuenow={completedLessons.length}
        >
          <div
            className="learning-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p>
          {completedLessons.length === lessons.length
            ? "All lessons completed. Keep practicing!"
            : `${progress}% completed — continue learning at your own pace.`}
        </p>
      </div>

      <div className="learning-lessons">
        {visibleLessons.map((lesson) => {
          const Icon = lesson.icon;
          const isExpanded = expandedLesson === lesson.id;
          const isCompleted = completedLessons.includes(lesson.id);

          return (
            <article
              className={`learning-lesson ${
                isExpanded ? "expanded" : ""
              } ${isCompleted ? "lesson-completed" : ""}`}
              key={lesson.id}
            >
              <button
                type="button"
                className="learning-lesson-main"
                onClick={() =>
                  setExpandedLesson(
                    isExpanded ? null : lesson.id
                  )
                }
                aria-expanded={isExpanded}
              >
                <div
                  className={`learning-lesson-icon ${lesson.color}`}
                >
                  <Icon size={17} />
                </div>

                <div className="learning-lesson-copy">
                  <div className="learning-lesson-category">
                    {lesson.category}
                  </div>

                  <div className="learning-lesson-title">
                    {lesson.title}
                  </div>

                  <div className="learning-lesson-meta">
                    {lesson.level}
                    <span>·</span>
                    {lesson.duration}
                  </div>
                </div>

                {isCompleted && (
                  <span
                    className="learning-completed-icon"
                    title="Lesson completed"
                  >
                    <CheckCircle2 size={17} />
                  </span>
                )}

                {isExpanded ? (
                  <ChevronDown size={15} />
                ) : (
                  <ChevronRight size={15} />
                )}
              </button>

              {isExpanded && (
                <div className="learning-lesson-details">
                  <p>{lesson.description}</p>

                  <div className="learning-example-label">
                    <Code2 size={13} />
                    Example
                  </div>

                  <pre className="learning-code">
                    <code>{lesson.example}</code>
                  </pre>

                  <div className="learning-solution">
                    <div className="learning-example-label">
                      <CheckCircle2 size={13} />
                      Suggested Solution
                    </div>

                    <pre className="learning-code">
                      <code>{lesson.solution}</code>
                    </pre>
                  </div>

                  <div className="learning-takeaway">
                    <Lightbulb size={15} />

                    <div>
                      <strong>Key takeaway</strong>
                      <p>{lesson.takeaway}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`learning-complete-button ${
                      isCompleted ? "completed" : ""
                    }`}
                    onClick={() => toggleCompleted(lesson.id)}
                  >
                    <ShieldCheck size={14} />

                    {isCompleted
                      ? "Mark as incomplete"
                      : "Mark as complete"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {!compact && (
        <div className="learning-resources-note">
          <BookOpen size={15} />

          <span>
            These lessons introduce common coding practices.
            Review your project's context before applying changes.
          </span>
        </div>
      )}
    </section>
  );
}
