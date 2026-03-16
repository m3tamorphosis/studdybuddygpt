"use client";

import { PdfUploader } from "@/components/PdfUploader";

type ChatBoxProps = {
  showUploader?: boolean;
};

export function ChatBox({ showUploader = true }: ChatBoxProps) {
  const toolItems = [
    {
      index: "01",
      title: "Summaries",
      description: "Turn long notes into a fast reviewer."
    },
    {
      index: "02",
      title: "Quiz + Score",
      description: "Generate 10 or 15 random questions."
    },
    {
      index: "03",
      title: "Key Terms",
      description: "Pull important vocabulary from the PDF."
    }
  ];

  return (
    <section className="panel workspace-panel relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-40 rounded-b-[2rem] bg-[radial-gradient(circle_at_top,rgba(254,224,71,0.08),transparent_72%)]" />
      <div className="mx-auto max-w-[100rem]">
        <div className="workspace-copy mb-7">
          <div className="max-w-4xl xl:max-w-[52rem]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean">
              PDF Study Material
            </p>
            <h2 className="display-title mt-3 max-w-[44rem] text-[2rem] font-semibold leading-[0.95] sm:text-[2.5rem]">
              Upload once, then open your full study workspace
            </h2>
            <p className="mt-4 max-w-[40rem] text-sm leading-8 text-[color:var(--text-muted)] sm:text-base">
              Your PDF becomes the source for summaries, quizzes, flashcards, key terms, and study notes.
            </p>
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="workspace-upload-shell space-y-4">
            {showUploader ? (
              <PdfUploader
                onTextExtracted={() => {}}
                redirectTo="/pdf-study"
              />
            ) : null}
          </div>

          <aside className="workspace-tools-wrap -mt-56 self-start xl:sticky xl:top-6 xl:-mt-56 xl:flex xl:justify-center">
            <div className="workspace-tools-panel">
              <p className="text-center text-base font-semibold uppercase tracking-[0.32em] text-[color:var(--text-main)]/80">
                Included Tools
              </p>
              <div className="mt-5 space-y-4">
                {toolItems.map((item) => (
                  <div className="workspace-tool-card" key={item.title}>
                    <div className="flex items-start gap-3.5">
                      <span className="workspace-tool-index">{Number(item.index)}</span>
                      <div>
                        <p className="text-[1.12rem] font-semibold text-[color:var(--text-main)]">
                          {item.title}
                        </p>
                        <p className="mt-2 text-[1.02rem] leading-8 text-[color:var(--text-muted)]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}


















