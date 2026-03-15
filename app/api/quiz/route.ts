import { NextResponse } from "next/server";

import {
  buildSourceContext,
  createGroqCompletion,
  parseQuizResponse,
  QuizQuestion
} from "@/lib/groq";

type QuizPayload = {
  questions: QuizQuestion[];
};

const ALLOWED_QUESTION_COUNTS = new Set([10, 15]);

function shuffleItems<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      topic?: string;
      sourceText?: string;
      count?: number;
    };
    const topic = body.topic?.trim();
    const subject = topic || "the uploaded PDF study material";
    const sourceContext = buildSourceContext(body.sourceText, `${subject} quiz questions`);
    const count = ALLOWED_QUESTION_COUNTS.has(body.count ?? 10) ? (body.count ?? 10) : 10;
    const variationToken = crypto.randomUUID().slice(0, 8);

    if (!topic && !body.sourceText?.trim()) {
      return NextResponse.json(
        { error: "A topic or PDF study material is required." },
        { status: 400 }
      );
    }

    const raw = await createGroqCompletion({
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            'Return valid JSON with a top-level "questions" array. Each question must contain "question", "options" (four strings), "answer", and "explanation". When PDF material is provided, every question and explanation must be grounded in that PDF. Do not include markdown. Avoid reusing the same question wording or the same option ordering.'
        },
        {
          role: "user",
          content: `Generate ${count} random multiple choice quiz questions about ${subject}. Include answers and explanations. Make the set varied and non-repetitive. Use a fresh mix of concepts, wording, and answer positions for this run. Variation token: ${variationToken}. If PDF material is provided, keep every question grounded in that PDF and avoid adding facts not found there.${sourceContext}`
        }
      ]
    });

    const parsedQuestions = parseQuizResponse(raw);

    if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      throw new Error("Quiz response was not in the expected format.");
    }

    const randomizedQuestions = shuffleItems(parsedQuestions)
      .map((question) => ({
        ...question,
        options: shuffleItems(question.options)
      }))
      .slice(0, count);

    return NextResponse.json({ questions: randomizedQuestions } satisfies QuizPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate quiz.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
