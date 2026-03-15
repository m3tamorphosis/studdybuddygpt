import { NextResponse } from "next/server";

import {
  buildSourceContext,
  createGroqCompletion,
  FlashcardItem,
  parseFlashcardResponse
} from "@/lib/groq";

type FlashcardPayload = {
  cards: FlashcardItem[];
};

const ALLOWED_FLASHCARD_COUNTS = new Set([10, 15]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      topic?: string;
      sourceText?: string;
      count?: number;
    };
    const topic = body.topic?.trim();
    const subject = topic || "the uploaded PDF study material";
    const sourceContext = buildSourceContext(body.sourceText, `${subject} flashcards`);
    const count = ALLOWED_FLASHCARD_COUNTS.has(body.count ?? 10) ? (body.count ?? 10) : 10;

    if (!topic && !body.sourceText?.trim()) {
      return NextResponse.json(
        { error: "A topic or PDF study material is required." },
        { status: 400 }
      );
    }

    const raw = await createGroqCompletion({
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            'Return valid JSON with a top-level "cards" array. Each card must contain "front" and "back". When PDF material is provided, every flashcard must be grounded in that PDF. Do not include markdown.'
        },
        {
          role: "user",
          content: `Generate ${count} random flashcards about ${subject}. Each flashcard should include a question on the front and answer on the back. Make the set varied and non-repetitive. If PDF material is provided, keep every card grounded in that PDF and avoid unsupported facts.${sourceContext}`
        }
      ]
    });

    const parsedCards = parseFlashcardResponse(raw);

    if (!Array.isArray(parsedCards) || parsedCards.length === 0) {
      throw new Error("Flashcard response was not in the expected format.");
    }

    return NextResponse.json({ cards: parsedCards.slice(0, count) } satisfies FlashcardPayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate flashcards.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
