"use client";

import { FormEvent, useState } from "react";
import { useEffect } from "react";

import { PdfUploader } from "@/components/PdfUploader";
import { QuizCard } from "@/components/QuizCard";
import { parseApiResponse } from "@/lib/api";
import type { QuizQuestion } from "@/lib/groq";
import { getPdfSession } from "@/lib/pdf-session";

export default function QuizPage() {
  const [questionCount, setQuestionCount] = useState<10 | 15>(10);
  const [showCountPicker, setShowCountPicker] = useState(false);
  const [topic, setTopic] = useState("");
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [answers, setAnswers] = useState<Record<number, { selected: string | null; isCorrect: boolean }>>({});
  const [submitted, setSubmitted] = useState(false);
  const [retakeKey, setRetakeKey] = useState(0);

  useEffect(() => {
    const session = getPdfSession();
    setSourceText(session.text);
    setPdfName(session.fileName);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowCountPicker(true);
  }

  async function generateQuiz(selectedCount: 10 | 15) {
    if (!topic.trim() && !sourceText.trim()) {
      setError("Enter a topic or upload a PDF first.");
      return;
    }

    setQuestionCount(selectedCount);
    setShowCountPicker(false);

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ topic, sourceText, count: selectedCount })
      });

      const data = await parseApiResponse<{ error?: string; questions?: QuizQuestion[] }>(res);

      if (!res.ok) {
        throw new Error(data.error ?? "Quiz request failed.");
      }

      setQuiz(data.questions ?? []);
      setAnswers({});
      setSubmitted(false);
      setRetakeKey((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const answeredCount = Object.keys(answers).length;
  const score = Object.values(answers).filter((item) => item.isCorrect).length;
  const canSubmit = quiz.length > 0 && answeredCount === quiz.length;

  function handleRetakeQuiz() {
    setAnswers({});
    setSubmitted(false);
    setRetakeKey((current) => current + 1);
  }

  return (
    <main className="space-y-8 py-8">
      <section className="panel p-6 sm:p-8">
        <a className="secondary-button mb-6 px-4 py-2 text-sm" href="/">
          Back Home
        </a>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sunrise">
          Quiz Generator
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">Build a focused practice set</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
          Enter a topic or upload a PDF and StudyBuddyGPT will generate random multiple choice
          questions with an answer key and explanations.
        </p>

        {sourceText ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Using PDF source: {pdfName || "Uploaded document"}
          </div>
        ) : null}

        <form className="mt-6 flex flex-col gap-4 sm:flex-row" onSubmit={handleSubmit}>
          {!sourceText ? (
            <input
              className="field"
              placeholder="Enter a topic, or upload a PDF below"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          ) : null}
          <button className="primary-button shrink-0" disabled={loading} type="submit">
            {loading ? "Generating..." : sourceText ? "Generate From PDF" : "Generate Quiz"}
          </button>
        </form>

        {!sourceText ? (
          <div className="mt-6">
            <PdfUploader
              onTextExtracted={(text, fileName) => {
                setSourceText(text);
                setPdfName(fileName);
              }}
              redirectTo="/pdf-study"
            />
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      {quiz.length ? (
        <section className="space-y-5">
          <div className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Quiz Score
              </p>
              {submitted ? (
                <p className="mt-2 text-3xl font-semibold text-ink">
                  {score} / {quiz.length}
                </p>
              ) : (
                <p className="mt-2 text-lg font-medium text-slate-600">
                  Submit the quiz to reveal your score
                </p>
              )}
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <p className="text-sm text-slate-600">
                Answered {answeredCount} of {quiz.length} questions
              </p>
              <div className="flex flex-wrap gap-3">
                {submitted ? (
                  <button
                    className="secondary-button px-5 py-3"
                    onClick={handleRetakeQuiz}
                    type="button"
                  >
                    Retake Quiz
                  </button>
                ) : null}
                <button
                  className="primary-button px-5 py-3"
                  disabled={!canSubmit}
                  onClick={() => setSubmitted(true)}
                  type="button"
                >
                  Submit Quiz
                </button>
              </div>
          </div>
          </div>

          {submitted ? (
            <div className="panel px-6 py-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Result
              </p>
              <p className="mt-2 text-lg font-semibold text-ink">
                You got {score} out of {quiz.length} correct.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Score: {Math.round((score / quiz.length) * 100)}%
              </p>
            </div>
          ) : null}

          <div className="grid gap-5">
            {quiz.map((item, index) => (
              <QuizCard
                key={`${retakeKey}-${item.question}-${index}`}
                answer={item.answer}
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
                showAnswer={submitted}
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="panel px-6 py-12 text-center text-sm text-slate-500">
          Your quiz cards will appear here.
        </section>
      )}

      {showCountPicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="panel w-full max-w-md p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Quiz Length
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">Pick number of questions</h2>
            <div className="mt-6 grid gap-3">
              {[10, 15].map((count) => (
                <button
                  key={count}
                  className="secondary-button w-full justify-center"
                  onClick={() => generateQuiz(count as 10 | 15)}
                  type="button"
                >
                  {count === 10 ? "10 Questions (Recommended)" : "15 Questions"}
                </button>
              ))}
            </div>
            <button
              className="mt-4 secondary-button w-full justify-center"
              onClick={() => setShowCountPicker(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}




