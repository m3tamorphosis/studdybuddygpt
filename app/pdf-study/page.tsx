"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Flashcard } from "@/components/Flashcard";
import { QuizCard } from "@/components/QuizCard";
import { parseApiResponse } from "@/lib/api";
import type { FlashcardItem, QuizQuestion, TutorResponse } from "@/lib/groq";
import {
  getPdfSession,
  getPdfStudyResults,
  savePdfDocument,
  savePdfStudyResults
} from "@/lib/pdf-session";
import {
  ensurePdfDocument,
  loadStudyArtifacts,
  saveQuizAttempt,
  saveStudyArtifact,
  type StoredPdfDocument
} from "@/lib/supabase/study";

type ActiveView = "quiz" | "flashcards" | "summary" | "key-terms" | "study-notes" | "ask" | null;
type LoadingMode = "quiz" | "flashcards" | "summary" | "key-terms" | "study-notes" | "ask" | null;

function renderKeyTermLine(line: string) {
  const trimmed = line.trim().replace(/^[-*]\s*/, "");

  if (!trimmed) {
    return null;
  }

  const parts = trimmed.match(/^([^:.-]{1,80})(\s*(?:-|:|–)\s*)(.+)$/);

  if (!parts) {
    return <span className="font-semibold text-[color:var(--text-main)]">{trimmed}</span>;
  }

  return (
    <>
      <span className="font-semibold text-[color:var(--text-main)]">{parts[1].trim()}</span>
      <span className="text-[color:var(--text-main)]">{`${parts[2]}${parts[3]}`}</span>
    </>
  );
}

function buildDisplayLines(text: string, mode: ActiveView) {
  const normalized = text.replace(/\r/g, "").trim();
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return lines;
  }

  if (mode === "summary" || mode === "study-notes" || mode === "ask") {
    const numberedLines = normalized
      .split(/(?=\s*\d+\.\s+)/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (numberedLines.length > 1) {
      return numberedLines;
    }

    const bulletLines = normalized
      .split(/(?=\s*[•●▪]\s+)/)
      .map((line) => line.replace(/^[•●▪]\s*/, "").trim())
      .filter(Boolean);

    if (bulletLines.length > 1) {
      return bulletLines;
    }

    const semicolonLines = normalized
      .split(/\s*;\s+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (semicolonLines.length > 1) {
      return semicolonLines;
    }
  }

  const sentenceLines = normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(])/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (sentenceLines.length > 1) {
    return sentenceLines;
  }

  return lines;
}

function renderStudyLine(line: string) {
  const trimmed = line.trim().replace(/^[-*]\s*/, "");

  if (!trimmed) {
    return null;
  }

  const termMatch = trimmed.match(/^([^:.-]{1,80})(\s*(?:-|:|–)\s*)(.+)$/);

  if (termMatch) {
    return (
      <>
        <span className="font-semibold text-[color:var(--text-main)]">{termMatch[1].trim()}</span>
        <span>{`${termMatch[2]}${termMatch[3]}`}</span>
      </>
    );
  }

  const conceptMatch = trimmed.match(/^(.{2,60}?)(\s+(?:is|are|was|were|can|helps|means|refers to|involves|includes|supports)\b[\s\S]*)$/i);

  if (conceptMatch) {
    return (
      <>
        <span className="font-semibold text-[color:var(--text-main)]">{conceptMatch[1].trim()}</span>
        <span>{conceptMatch[2]}</span>
      </>
    );
  }

  return <span>{trimmed}</span>;
}

function renderResponseContent(
  text: string,
  mode: ActiveView,
  section: "explanation" | "example" | "summary"
): ReactNode {
  const displayLines = buildDisplayLines(text, mode);
  const useNumberedLayout = mode === "key-terms" || displayLines.length > 1;

  if (!useNumberedLayout) {
    return <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[color:var(--text-main)]">{renderStudyLine(text)}</p>;
  }

  return (
    <div className="mt-3 space-y-3 text-sm leading-7 text-[color:var(--text-main)]">
      {displayLines.map((line, index) => (
        <div key={`${section}-${index}`} className="flex gap-3 leading-7">
          <span className="min-w-[1.5rem] font-semibold text-[color:var(--text-muted)]">{index + 1}.</span>
          <p className="flex-1 leading-7">
            {mode === "key-terms" && section !== "summary" ? renderKeyTermLine(line) : renderStudyLine(line)}
          </p>
        </div>
      ))}
    </div>
  );
}
export default function PdfStudyPage() {
  const [questionCount, setQuestionCount] = useState<10 | 15>(10);
  const { user } = useAuth();
  const [document, setDocument] = useState<StoredPdfDocument | null>(null);
  const [remoteLoadedForDocument, setRemoteLoadedForDocument] = useState<string | null>(null);
  const [flashcardCount, setFlashcardCount] = useState<10 | 15>(10);
  const [fileName, setFileName] = useState("");
  const [hasPdf, setHasPdf] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [cards, setCards] = useState<FlashcardItem[]>([]);
  const [tutorResponse, setTutorResponse] = useState<TutorResponse | null>(null);
  const [summaryResponse, setSummaryResponse] = useState<TutorResponse | null>(null);
  const [keyTermsResponse, setKeyTermsResponse] = useState<TutorResponse | null>(null);
  const [studyNotesResponse, setStudyNotesResponse] = useState<TutorResponse | null>(null);
  const [loadingMode, setLoadingMode] = useState<LoadingMode>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showQuizCountPicker, setShowQuizCountPicker] = useState(false);
  const [showFlashcardCountPicker, setShowFlashcardCountPicker] = useState(false);
  const [answers, setAnswers] = useState<Record<number, { selected: string | null; isCorrect: boolean }>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [retakeKey, setRetakeKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const answeredCount = Object.keys(answers).length;
  const quizScore = Object.values(answers).filter((item) => item.isCorrect).length;
  const canSubmitQuiz = quiz.length > 0 && answeredCount === quiz.length;

  useEffect(() => {
    const session = getPdfSession();
    const storedResults = getPdfStudyResults();

    setFileName(session.fileName);
    setSourceText(session.text);
    setPreviewUrl(session.previewUrl);
    setHasPdf(Boolean(session.text.trim()));
    setDocument(session.document ?? null);

    const nextQuiz = Array.isArray(storedResults.quiz) ? (storedResults.quiz as QuizQuestion[]) : [];
    const nextCards = Array.isArray(storedResults.flashcards)
      ? (storedResults.flashcards as FlashcardItem[])
      : [];

    setQuiz(nextQuiz);
    setCards(nextCards);
    setSummaryResponse(storedResults.summary ?? null);
    setKeyTermsResponse(storedResults.keyTerms ?? null);
    setStudyNotesResponse(storedResults.studyNotes ?? null);

    const restoredActiveView = storedResults.activeView ?? null;
    setActiveView(restoredActiveView);

    if (restoredActiveView === "summary" && storedResults.summary) {
      setTutorResponse(storedResults.summary);
    } else if (restoredActiveView === "key-terms" && storedResults.keyTerms) {
      setTutorResponse(storedResults.keyTerms);
    } else if (restoredActiveView === "study-notes" && storedResults.studyNotes) {
      setTutorResponse(storedResults.studyNotes);
    } else if (restoredActiveView === "ask" && storedResults.ask) {
      setTutorResponse(storedResults.ask);
    } else {
      setTutorResponse(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (!user || !sourceText.trim() || !fileName || (document && document.userId === user.id)) {
      return () => {
        active = false;
      };
    }

    ensurePdfDocument({ user, fileName, text: sourceText })
      .then((persistedDocument) => {
        if (!active || !persistedDocument) {
          return;
        }

        setDocument(persistedDocument);
        savePdfDocument(persistedDocument);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [user, sourceText, fileName, document]);

  useEffect(() => {
    let active = true;

    if (!user || !document?.id || remoteLoadedForDocument === document.id) {
      return () => {
        active = false;
      };
    }

    loadStudyArtifacts({ userId: user.id, documentId: document.id })
      .then((artifacts) => {
        if (!active) {
          return;
        }

        if (artifacts.quiz?.length) {
          setQuiz((current) => (current.length ? current : artifacts.quiz ?? []));
        }

        if (artifacts.flashcards?.length) {
          setCards((current) => (current.length ? current : artifacts.flashcards ?? []));
        }

        if (artifacts.summary) {
          setSummaryResponse((current) => current ?? artifacts.summary ?? null);
        }

        if (artifacts.keyTerms) {
          setKeyTermsResponse((current) => current ?? artifacts.keyTerms ?? null);
        }

        if (artifacts.studyNotes) {
          setStudyNotesResponse((current) => current ?? artifacts.studyNotes ?? null);
        }

        setRemoteLoadedForDocument(document.id);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [user, document, remoteLoadedForDocument]);

  async function persistArtifact(
    artifactType: "summary" | "key_terms" | "study_notes" | "flashcards" | "quiz" | "ask",
    payload: Record<string, unknown>
  ) {
    if (!user || !document?.id) {
      return;
    }

    try {
      await saveStudyArtifact({
        userId: user.id,
        documentId: document.id,
        artifactType,
        payload
      });
    } catch {
      // Keep the local study flow working even if the remote save fails.
    }
  }


  function updateStoredResults(next: {
    quiz?: QuizQuestion[];
    flashcards?: FlashcardItem[];
    summary?: TutorResponse | null;
    keyTerms?: TutorResponse | null;
    studyNotes?: TutorResponse | null;
    ask?: TutorResponse | null;
    activeView?: ActiveView;
  }) {
    savePdfStudyResults({
      ...getPdfStudyResults(),
      ...(next.quiz ? { quiz: next.quiz } : {}),
      ...(next.flashcards ? { flashcards: next.flashcards } : {}),
      ...(next.summary !== undefined ? { summary: next.summary } : {}),
      ...(next.keyTerms !== undefined ? { keyTerms: next.keyTerms } : {}),
      ...(next.studyNotes !== undefined ? { studyNotes: next.studyNotes } : {}),
      ...(next.ask !== undefined ? { ask: next.ask } : {}),
      ...(next.activeView !== undefined ? { activeView: next.activeView } : {}),
    });
  }

  function actionButtonClass(mode: Exclude<ActiveView, null>) {
    const isActive = activeView === mode;

    return [
      "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition",
      isActive ? "primary-button" : "secondary-button"
    ].join(" ");
  }

  function handleRetakeQuiz() {
    setAnswers({});
    setQuizSubmitted(false);
    setRetakeKey((current) => current + 1);
  }

  function handleSubmitQuiz() {
    setQuizSubmitted(true);

    if (!user) {
      return;
    }

    void saveQuizAttempt({
      userId: user.id,
      documentId: document?.id ?? null,
      questionCount,
      score: quizScore,
      totalQuestions: quiz.length,
      answers: answers as Record<string, unknown>
    });
  }

  async function generateQuiz() {
    setShowQuizCountPicker(true);
  }

  async function runQuizGeneration(selectedCount: 10 | 15) {
    if (!sourceText.trim()) {
      setError("Upload a PDF from the home page first.");
      return;
    }

    setQuestionCount(selectedCount);
    setShowQuizCountPicker(false);
    setLoadingMode("quiz");
    setError(null);

    try {
      const response = await fetch("/api/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sourceText, count: selectedCount })
      });

      const data = await parseApiResponse<{ error?: string; questions?: QuizQuestion[] }>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Quiz request failed.");
      }

      const nextQuiz = data.questions ?? [];
      setQuiz(nextQuiz);
      updateStoredResults({ quiz: nextQuiz, activeView: "quiz" });
      setAnswers({});
      setQuizSubmitted(false);
      setRetakeKey((current) => current + 1);
      setActiveView("quiz");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz.");
    } finally {
      setLoadingMode(null);
    }
  }

  async function generateFlashcards() {
    setShowFlashcardCountPicker(true);
  }

  async function runFlashcardGeneration(selectedCount: 10 | 15) {
    if (!sourceText.trim()) {
      setError("Upload a PDF from the home page first.");
      return;
    }

    setFlashcardCount(selectedCount);
    setShowFlashcardCountPicker(false);
    setLoadingMode("flashcards");
    setError(null);

    try {
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sourceText, count: selectedCount })
      });

      const data = await parseApiResponse<{ error?: string; cards?: FlashcardItem[] }>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Flashcard request failed.");
      }

      const nextCards = data.cards ?? [];
      setCards(nextCards);
      updateStoredResults({ flashcards: nextCards, activeView: "flashcards" });
      setActiveView("flashcards");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create flashcards.");
    } finally {
      setLoadingMode(null);
    }
  }

  async function summarizePdf() {
    if (summaryResponse) {
      setTutorResponse(summaryResponse);
      setActiveView("summary");
      updateStoredResults({ activeView: "summary" });
      setError(null);
      return;
    }

    if (!sourceText.trim()) {
      setError("Upload a PDF from the home page first.");
      return;
    }

    setLoadingMode("summary");
    setError(null);

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "Summarize the uploaded PDF for a student",
          mode: "summary",
          sourceText
        })
      });

      const data = await parseApiResponse<{ error?: string } & TutorResponse>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Summary request failed.");
      }

      setTutorResponse(data);
      setSummaryResponse(data);
      updateStoredResults({ summary: data, activeView: "summary" });
      setActiveView("summary");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to summarize PDF.");
    } finally {
      setLoadingMode(null);
    }
  }

  async function extractKeyTerms() {
    if (keyTermsResponse) {
      setTutorResponse(keyTermsResponse);
      setActiveView("key-terms");
      updateStoredResults({ activeView: "key-terms" });
      setError(null);
      return;
    }

    if (!sourceText.trim()) {
      setError("Upload a PDF from the home page first.");
      return;
    }

    setLoadingMode("key-terms");
    setError(null);

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "Extract key terms from the uploaded PDF for a student",
          mode: "key-terms",
          sourceText
        })
      });

      const data = await parseApiResponse<{ error?: string } & TutorResponse>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Key terms request failed.");
      }

      setTutorResponse(data);
      setKeyTermsResponse(data);
      updateStoredResults({ keyTerms: data, activeView: "key-terms" });
      setActiveView("key-terms");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract key terms.");
    } finally {
      setLoadingMode(null);
    }
  }

  async function generateStudyNotes() {
    if (studyNotesResponse) {
      setTutorResponse(studyNotesResponse);
      setActiveView("study-notes");
      updateStoredResults({ activeView: "study-notes" });
      setError(null);
      return;
    }

    if (!sourceText.trim()) {
      setError("Upload a PDF from the home page first.");
      return;
    }

    setLoadingMode("study-notes");
    setError(null);

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: "Create student study notes from the uploaded PDF",
          mode: "study-notes",
          sourceText
        })
      });

      const data = await parseApiResponse<{ error?: string } & TutorResponse>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Study notes request failed.");
      }

      setTutorResponse(data);
      setStudyNotesResponse(data);
      updateStoredResults({ studyNotes: data, activeView: "study-notes" });
      setActiveView("study-notes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate study notes.");
    } finally {
      setLoadingMode(null);
    }
  }

  async function askAboutPdf() {
    const prompt = searchQuery.trim();

    if (!sourceText.trim()) {
      setError("Upload a PDF from the home page first.");
      return;
    }

    if (!prompt) {
      setError("Type a word, meaning, or question to search the PDF.");
      return;
    }

    setLoadingMode("ask");
    setError(null);

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          mode: "ask",
          sourceText
        })
      });

      const data = await parseApiResponse<{ error?: string } & TutorResponse>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "PDF search request failed.");
      }

      setTutorResponse(data);
      updateStoredResults({ ask: data, activeView: "ask" });
      setActiveView("ask");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search this PDF.");
    } finally {
      setLoadingMode(null);
    }
  }

  function handleAskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askAboutPdf();
  }

  const tutorCardLabels =
    activeView === "key-terms"
      ? {
          explanation: "Key Terms",
          example: "Definitions",
          summary: "Quick Recall"
        }
      : activeView === "study-notes"
        ? {
            explanation: "Main Notes",
            example: "Important Details",
            summary: "Quick Reviewer"
          }
        : activeView === "ask"
          ? {
              explanation: "Meaning",
              example: "Context",
              summary: "Quick Answer"
            }
          : {
              explanation: "Explanation",
              example: "Example",
              summary: "Summary"
            };

  return (
    <main className="space-y-8 py-8">
      <section className="panel p-6 sm:p-8">
        <a className="secondary-button mb-6 px-4 py-2 text-sm" href="/">
          Back Home
        </a>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ocean">PDF Study Mode</p>
        <h1 className="display-title mt-3 text-4xl font-semibold tracking-tight text-[color:var(--text-main)]">
          Use your uploaded PDF as the study source
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
          Use this PDF to generate quizzes, flashcards, summaries, key terms, and study notes in one place.
        </p>

        <div className="mt-6 rounded-3xl border border-[color:var(--field-border)] bg-[color:var(--field-bg)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-main)]">Active PDF</p>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                {hasPdf ? fileName || "Uploaded PDF is loaded in this session." : "No PDF is loaded yet."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {previewUrl ? (
                <button
                  className="secondary-button gap-2 px-4 py-3"
                  onClick={() => setShowPreview(true)}
                  type="button"
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    [ ]
                  </span>
                  Preview PDF
                </button>
              ) : null}

            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className={actionButtonClass("quiz")}
            disabled={!hasPdf || loadingMode !== null}
            onClick={generateQuiz}
            type="button"
          >
            {loadingMode === "quiz" ? "Generating Quiz..." : "Generate PDF Quiz"}
          </button>
          <button
            className={actionButtonClass("flashcards")}
            disabled={!hasPdf || loadingMode !== null}
            onClick={generateFlashcards}
            type="button"
          >
            {loadingMode === "flashcards" ? "Creating Flashcards..." : "Create PDF Flashcards"}
          </button>
          <button
            className={actionButtonClass("summary")}
            disabled={!hasPdf || loadingMode !== null}
            onClick={summarizePdf}
            type="button"
          >
            {loadingMode === "summary" ? "Summarizing..." : summaryResponse ? "Summary Ready" : "Summarize PDF"}
          </button>
          <button
            className={actionButtonClass("key-terms")}
            disabled={!hasPdf || loadingMode !== null}
            onClick={extractKeyTerms}
            type="button"
          >
            {loadingMode === "key-terms" ? "Extracting..." : keyTermsResponse ? "Key Terms Ready" : "Extract Key Terms"}
          </button>
          <button
            className={actionButtonClass("study-notes")}
            disabled={!hasPdf || loadingMode !== null}
            onClick={generateStudyNotes}
            type="button"
          >
            {loadingMode === "study-notes" ? "Writing Notes..." : studyNotesResponse ? "Study Notes Ready" : "Study Notes"}
          </button>
        </div>

        <form
          className="mt-5 flex flex-col gap-3 rounded-3xl border border-[color:var(--field-border)] bg-[color:var(--field-bg)] p-4 sm:flex-row sm:items-center"
          onSubmit={handleAskSubmit}
        >
          <input
            className="field flex-1"
            disabled={!hasPdf || loadingMode !== null}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search a term, ask for a meaning, or type a question about this PDF"
            value={searchQuery}
          />
          <button
            className={actionButtonClass("ask")}
            disabled={!hasPdf || loadingMode !== null}
            type="submit"
          >
            {loadingMode === "ask" ? "Searching..." : "Search PDF"}
          </button>
        </form>

        {!hasPdf ? (
          <div className="mt-6 rounded-2xl border border-[color:var(--secondary-border)] bg-[color:var(--secondary-bg)] px-4 py-3 text-sm text-[color:var(--secondary-text)]">
            Upload a PDF from the home page first to use this study mode.
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-[color:var(--secondary-border)] bg-[color:var(--secondary-bg)] px-4 py-3 text-sm text-[color:var(--text-main)]">
            {error}
          </div>
        ) : null}
      </section>

      {activeView === "quiz" ? (
        <section className="space-y-5">
          <div className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                Quiz Score
              </p>
              {quizSubmitted ? (
                <p className="mt-2 text-3xl font-semibold text-[color:var(--text-main)]">
                  {quizScore} / {quiz.length}
                </p>
              ) : (
                <p className="mt-2 text-lg font-medium text-[color:var(--text-muted)]">
                  Submit the quiz to reveal your score
                </p>
              )}
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <p className="text-sm text-[color:var(--text-muted)]">
                Answered {answeredCount} of {quiz.length} questions
              </p>
              <div className="flex flex-wrap gap-3">
                {quizSubmitted ? (
                  <button className="secondary-button px-5 py-3" onClick={handleRetakeQuiz} type="button">
                    Retake Quiz
                  </button>
                ) : null}
                <button
                  className="primary-button px-5 py-3"
                  disabled={!canSubmitQuiz}
                  onClick={handleSubmitQuiz}
                  type="button"
                >
                  Submit Quiz
                </button>
              </div>
            </div>
          </div>

          {quizSubmitted ? (
            <div className="panel px-6 py-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                Result
              </p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--text-main)]">
                You got {quizScore} out of {quiz.length} correct.
              </p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                Score: {Math.round((quizScore / quiz.length) * 100)}%
              </p>
            </div>
          ) : null}

          {quiz.length ? (
            quiz.map((item, index) => (
              <QuizCard
                key={`${retakeKey}-${item.question}-${index}`}
                answer={item.answer}
                disabled={quizSubmitted}
                explanation={item.explanation}
                index={index + 1}
                onAnswerChange={(questionIndex, selected, isCorrect) => {
                  setAnswers((current) => ({
                    ...current,
                    [questionIndex]: { selected, isCorrect }
                  }));
                }}
                options={item.options}
                question={item.question}
                showAnswer={quizSubmitted}
              />
            ))
          ) : (
            <section className="panel px-6 py-12 text-center text-sm text-[color:var(--text-muted)]">
              No quiz questions were generated from this PDF.
            </section>
          )}
        </section>
      ) : null}

      {activeView === "flashcards" ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.length ? (
            cards.map((card, index) => (
              <Flashcard back={card.back} front={card.front} key={`${card.front}-${index}`} />
            ))
          ) : (
            <section className="panel px-6 py-12 text-center text-sm text-[color:var(--text-muted)] md:col-span-2 xl:col-span-3">
              No flashcards were generated from this PDF.
            </section>
          )}
        </section>
      ) : null}

      {showPreview && previewUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] shadow-panel">
            <div className="flex items-center justify-between border-b border-[color:var(--panel-border)] px-5 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                  PDF Preview
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{fileName || "Uploaded PDF"}</p>
              </div>
              <button
                className="secondary-button px-3 py-2 text-sm"
                onClick={() => setShowPreview(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <iframe className="h-full w-full bg-[color:var(--field-bg)]" src={previewUrl} title={fileName || "PDF preview"} />
          </div>
        </div>
      ) : null}

      {showQuizCountPicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="panel w-full max-w-md p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
              Quiz Length
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[color:var(--text-main)]">Pick number of questions</h2>
            <div className="mt-6 grid gap-3">
              {[10, 15].map((count) => (
                <button
                  key={count}
                  className="secondary-button w-full justify-center"
                  onClick={() => runQuizGeneration(count as 10 | 15)}
                  type="button"
                >
                  {count === 10 ? "10 Questions (Recommended)" : "15 Questions"}
                </button>
              ))}
            </div>
            <button className="mt-4 secondary-button w-full justify-center" onClick={() => setShowQuizCountPicker(false)} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {showFlashcardCountPicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="panel w-full max-w-md p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
              Flashcard Count
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[color:var(--text-main)]">Pick number of flashcards</h2>
            <div className="mt-6 grid gap-3">
              {[10, 15].map((count) => (
                <button
                  key={count}
                  className="secondary-button w-full justify-center"
                  onClick={() => runFlashcardGeneration(count as 10 | 15)}
                  type="button"
                >
                  {count === 10 ? "10 Flashcards (Recommended)" : "15 Flashcards"}
                </button>
              ))}
            </div>
            <button className="mt-4 secondary-button w-full justify-center" onClick={() => setShowFlashcardCountPicker(false)} type="button">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {activeView === "summary" || activeView === "key-terms" || activeView === "study-notes" || activeView === "ask" ? (
        tutorResponse ? (
          <section className="grid gap-4 md:grid-cols-3">
            <article className="panel p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                {tutorCardLabels.explanation}
              </h3>
              {renderResponseContent(tutorResponse.explanation, activeView, "explanation")}
            </article>
            <article className="panel p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                {tutorCardLabels.example}
              </h3>
              {renderResponseContent(tutorResponse.example, activeView, "example")}
            </article>
            <article className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--field-bg)] p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                {tutorCardLabels.summary}
              </h3>
              {renderResponseContent(tutorResponse.summary, activeView, "summary")}
            </article>
          </section>
        ) : (
          <section className="panel px-6 py-12 text-center text-sm text-[color:var(--text-muted)]">
            No tutor response was generated from this PDF.
          </section>
        )
      ) : null}
    </main>
  );
}
































