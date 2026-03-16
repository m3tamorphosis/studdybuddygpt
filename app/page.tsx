import { ChatBox } from "@/components/ChatBox";

export default function HomePage() {
  return (
    <main className="space-y-6 py-3">
      <section className="hero-panel panel overflow-hidden p-6 sm:p-8 lg:p-9">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ocean">
              StudyBuddyGPT
            </p>
            <h1 className="display-title mt-5 max-w-3xl text-[2.8rem] font-semibold leading-[0.96] sm:text-[3.5rem] xl:text-[4.2rem]">
              Study from your PDF with quizzes, flashcards, key terms, and notes.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[color:var(--text-muted)] sm:text-[1.05rem]">
              Upload your notes once, then use StudyBuddyGPT to summarize, explain, quiz, extract key terms, and build study notes from the same material.
            </p>
          </div>

          <div className="study-flow-panel rounded-[1.8rem] p-5 backdrop-blur-sm">
            <p className="eyebrow-label text-xs font-semibold uppercase text-ocean">Study Flow</p>
            <div className="mt-5 grid gap-3">
              <div className="study-flow-card">
                <div className="flex items-start gap-4">
                  <span className="study-flow-index">1</span>
                  <div>
                    <p className="feature-card-title text-2xl font-semibold leading-none text-[color:var(--text-main)]">
                      Tutor + Summary
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                      Get explanations and quick PDF summaries for faster review.
                    </p>
                  </div>
                </div>
              </div>
              <div className="study-flow-card">
                <div className="flex items-start gap-4">
                  <span className="study-flow-index">2</span>
                  <div>
                    <p className="feature-card-title text-2xl font-semibold leading-none text-[color:var(--text-main)]">
                      Quiz + Flashcards
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                      Generate scored practice sets and quick review cards from your PDF.
                    </p>
                  </div>
                </div>
              </div>
              <div className="study-flow-card">
                <div className="flex items-start gap-4">
                  <span className="study-flow-index">3</span>
                  <div>
                    <p className="feature-card-title text-2xl font-semibold leading-none text-[color:var(--text-main)]">
                      Key Terms + Notes
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                      Pull out important terms and turn long readings into cleaner study notes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ChatBox />
    </main>
  );
}
