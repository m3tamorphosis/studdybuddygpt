"use client";

import { useState } from "react";

type FlashcardProps = {
  front: string;
  back: string;
};

export function Flashcard({ front, back }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      className="group h-64 w-full [perspective:1200px]"
      onClick={() => setFlipped((value) => !value)}
      type="button"
    >
      <div
        className={[
          "relative h-full w-full rounded-[2rem] transition duration-500 [transform-style:preserve-3d]",
          flipped ? "[transform:rotateY(180deg)]" : ""
        ].join(" ")}
      >
        <div className="absolute inset-0 rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6 shadow-panel [backface-visibility:hidden]">
          <div className="flex h-full flex-col justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              Front
            </span>
            <p className="text-left text-xl font-semibold leading-8 text-[color:var(--text-main)]">{front}</p>
            <span className="text-left text-sm text-[color:var(--text-muted)]">Click to reveal the answer</span>
          </div>
        </div>

        <div className="absolute inset-0 rounded-[2rem] border border-[color:var(--field-border)] bg-[color:var(--field-bg)] p-6 text-[color:var(--text-main)] shadow-panel [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex h-full flex-col justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--text-muted)]">
              Back
            </span>
            <p className="text-left text-lg leading-8 text-[color:var(--text-main)]">{back}</p>
            <span className="text-left text-sm text-[color:var(--text-muted)]">Click again to flip back</span>
          </div>
        </div>
      </div>
    </button>
  );
}
