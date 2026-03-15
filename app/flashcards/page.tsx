"use client";

import { FormEvent, useState } from "react";
import { useEffect } from "react";

import { Flashcard } from "@/components/Flashcard";
import { PdfUploader } from "@/components/PdfUploader";
import { parseApiResponse } from "@/lib/api";
import type { FlashcardItem } from "@/lib/groq";
import { getPdfSession } from "@/lib/pdf-session";

export default function FlashcardsPage() {
  const [cardCount, setCardCount] = useState<10 | 15>(10);
  const [showCountPicker, setShowCountPicker] = useState(false);
  const [topic, setTopic] = useState("");
  const [cards, setCards] = useState<FlashcardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [pdfName, setPdfName] = useState("");

  useEffect(() => {
    const session = getPdfSession();
    setSourceText(session.text);
    setPdfName(session.fileName);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowCountPicker(true);
  }

  async function generateFlashcards(selectedCount: 10 | 15) {
    if (!topic.trim() && !sourceText.trim()) {
      setError("Enter a topic or upload a PDF first.");
      return;
    }

    setCardCount(selectedCount);
    setShowCountPicker(false);

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ topic, sourceText, count: selectedCount })
      });

      const data = await parseApiResponse<{ error?: string; cards?: FlashcardItem[] }>(res);

      if (!res.ok) {
        throw new Error(data.error ?? "Flashcard request failed.");
      }

      setCards(data.cards ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-8 py-8">
      <section className="panel p-6 sm:p-8">
        <a className="secondary-button mb-6 px-4 py-2 text-sm" href="/">
          Back Home
        </a>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ocean">
          Flashcards
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
          Create instant review cards
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
          Generate five flashcards from a topic or directly from an uploaded PDF, then click each
          card to flip between the prompt and answer.
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
            {loading ? "Creating..." : sourceText ? "Create From PDF" : "Create Flashcards"}
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

      {cards.length ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, index) => (
            <Flashcard back={card.back} front={card.front} key={`${card.front}-${index}`} />
          ))}
        </section>
      ) : (
        <section className="panel px-6 py-12 text-center text-sm text-slate-500">
          Your flashcards will appear here.
        </section>
      )}

      {showCountPicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="panel w-full max-w-md p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Flashcard Count
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">Pick number of flashcards</h2>
            <div className="mt-6 grid gap-3">
              {[10, 15].map((count) => (
                <button
                  key={count}
                  className="secondary-button w-full justify-center"
                  onClick={() => generateFlashcards(count as 10 | 15)}
                  type="button"
                >
                  {count === 10 ? "10 Flashcards (Recommended)" : "15 Flashcards"}
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
