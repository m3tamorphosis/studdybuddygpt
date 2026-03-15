"use client";

import { useEffect, useState } from "react";

export type QuizCardProps = {
  index: number;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  showAnswer?: boolean;
  disabled?: boolean;
  onAnswerChange?: (index: number, selected: string | null, isCorrect: boolean) => void;
};

export function QuizCard({
  index,
  question,
  options,
  answer,
  explanation,
  showAnswer = false,
  disabled = false,
  onAnswerChange
}: QuizCardProps) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!showAnswer) {
      setSelected(null);
    }
  }, [question, options, showAnswer]);

  const isCorrect = selected === answer;

  function handleSelect(option: string) {
    if (disabled) {
      return;
    }

    setSelected(option);
    onAnswerChange?.(index, option, option === answer);
  }

  return (
    <article className="panel p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-[color:var(--secondary-border)] bg-[color:var(--secondary-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--secondary-text)]">
          Question {index}
        </span>
        {showAnswer ? (
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            Answer Revealed
          </span>
        ) : null}
      </div>

      <h3 className="mt-4 text-lg font-semibold text-[color:var(--text-main)]">{question}</h3>

      <div className="mt-5 grid gap-3">
        {options.map((option) => {
          const active = selected === option;

          return (
            <button
              key={option}
              className={[
                "rounded-[1.35rem] border px-5 py-4 text-left text-sm font-medium transition-all duration-200 ease-out outline-none focus:outline-none focus:ring-0",
                disabled ? "cursor-default" : "cursor-pointer",
                active
                  ? "border-[color:var(--secondary-border)] bg-[color:var(--quiz-choice-selected-bg)] text-[color:var(--text-main)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_18px_rgba(0,0,0,0.06)] scale-[1.01]"
                  : "border-[color:var(--secondary-border)] bg-[color:var(--secondary-bg)] text-[color:var(--secondary-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-[color:var(--text-main)]/20 hover:text-[color:var(--text-main)] hover:border-[color:var(--field-border)]"
              ].join(" ")}
              disabled={disabled}
              onClick={() => handleSelect(option)}
              type="button"
            >
              {option}
            </button>
          );
        })}
      </div>

      {selected ? (
        <p className="mt-4 text-sm text-[color:var(--text-muted)]">
          Selected: <span className="font-medium text-[color:var(--text-main)]">{selected}</span>
        </p>
      ) : null}

      {showAnswer ? (
        <div
          className={[
            "mt-5 rounded-2xl px-4 py-4 text-sm",
            isCorrect
              ? "border border-[color:var(--field-border)] bg-[color:var(--field-bg)] text-[color:var(--text-main)]"
              : "border border-[color:var(--secondary-border)] bg-[color:var(--secondary-bg)] text-[color:var(--secondary-text)]"
          ].join(" ")}
        >
          <p>
            <span className="font-semibold">Correct answer:</span> {answer}
          </p>
          <p className="mt-2 leading-7">{explanation}</p>
          {selected ? (
            <p className="mt-2 font-medium">
              {isCorrect ? "You chose the correct option." : "Your current selection is incorrect."}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
