import { NextResponse } from "next/server";

import {
  buildSourceContext,
  buildSummarySourceContext,
  createGroqCompletion,
  parseTutorResponse,
  TutorResponse
} from "@/lib/groq";

type TutorMode = "general" | "summary" | "key-terms" | "study-notes" | "ask";

function getTutorPrompt(mode: TutorMode, effectivePrompt: string) {
  if (mode === "summary") {
    return {
      system:
        'Return valid JSON with keys "explanation", "example", and "summary". Base the answer only on the provided PDF material when it exists. Stay faithful to the PDF. Do not include markdown. Keep each field concise and structured for student review.',
      user: `Create a student-friendly PDF summary.\n\nRules:\n- In "explanation", write 4 to 6 short bullet-style study points, one per line.\n- In "example", give 1 short concrete example or application from the PDF.\n- In "summary", write 3 short quick-review lines.\n- Only use information supported by the PDF.\n- Do not add outside explanations or textbook knowledge.\n- If a detail is missing from the PDF, say "Not clearly stated in the PDF."\n\nTask: ${effectivePrompt}`
    };
  }

  if (mode === "key-terms") {
    return {
      system:
        'Return valid JSON with keys "explanation", "example", and "summary". Base the answer only on the provided PDF material when it exists. Do not include markdown. Keep the response structured, compact, and useful for memorization.',
      user: `Extract the full set of key terms from the PDF for a student.\n\nRules:\n- In "explanation", list all important terms supported by the PDF, one term per line.\n- Do not randomize, sample, or limit the list unless the PDF is extremely long.\n- If the PDF is long, still include as many important terms as the available PDF context supports.\n- In "example", give short definitions in the format "Term - definition", one per line, for the same terms.\n- In "summary", write 3 to 5 quick recall lines about the most important terms to memorize.\n- Prefer exact terminology from the PDF.\n- Do not invent terms, definitions, or categories that are not supported by the PDF.\n- Do not fill missing definitions from general knowledge.\n- If a term appears important but the PDF does not define it clearly, say "Not clearly defined in the PDF."\n\nTask: ${effectivePrompt}`
    };
  }

  if (mode === "study-notes") {
    return {
      system:
        'Return valid JSON with keys "explanation", "example", and "summary". Base the answer only on the provided PDF material when it exists. Do not include markdown. Make the result look like clean student notes, not a generic essay.',
      user: `Create student study notes from the PDF.\n\nRules:\n- In "explanation", write 5 to 8 main notes, one short note per line.\n- In "example", write 4 to 6 supporting details or important relationships, one per line.\n- In "summary", write 3 to 5 quick reviewer lines.\n- Keep the notes accurate to the PDF and focused on the most testable points.\n- Do not add unsupported facts or outside explanations.\n- If something is unclear in the PDF, say "Not clearly stated in the PDF."\n\nTask: ${effectivePrompt}`
    };
  }

  if (mode === "ask") {
    return {
      system:
        'Return valid JSON with keys "explanation", "example", and "summary". Base the answer only on the provided PDF material when it exists. Do not include markdown. Keep the response accurate, compact, and lookup-style.',
      user: `Answer this PDF search or lookup request for a student.\n\nRules:\n- In "explanation", give the direct meaning or answer first. For short search terms, write exactly one line in the format "TERM: concise definition from the PDF".\n- Do not leave "explanation" empty. If a useful meaning appears anywhere in the PDF context, put it here first.\n- In "example", provide one short supporting context line or where/how the term is used in the PDF.\n- In "summary", give one short quick-answer line for review.\n- Only use information supported by the PDF.\n- Do not add outside knowledge, guesses, or extra textbook explanation.\n- If the PDF does not clearly answer the query, write "Not clearly stated in the PDF." in all three fields.\n- Fill all three fields.\n\nQuery: ${effectivePrompt}`
    };
  }

  return {
    system:
      'Return valid JSON with keys "explanation", "example", and "summary". Base the answer on the provided PDF material when it exists. Stay faithful to the PDF. If the PDF does not support a detail, say so briefly. Do not include markdown.',
    user: `Explain the following topic in simple terms for a student. Then provide an example and a short summary. If PDF material is provided, answer from that material first and keep the response accurate to the document.\n\nTopic: ${effectivePrompt}`
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      sourceText?: string;
      mode?: TutorMode;
    };
    const prompt = body.prompt?.trim();
    const mode = body.mode ?? "general";
    const effectivePrompt = prompt || "Summarize the uploaded PDF for a student";
    const sourceContext = mode === "summary"
      ? buildSummarySourceContext(body.sourceText, effectivePrompt)
      : buildSourceContext(body.sourceText, effectivePrompt);

    if (!prompt && !body.sourceText?.trim()) {
      return NextResponse.json(
        { error: "A question or PDF study material is required." },
        { status: 400 }
      );
    }

    const promptConfig = getTutorPrompt(mode, effectivePrompt);

    const raw = await createGroqCompletion({
      temperature: mode === "general" ? 0.35 : mode === "ask" ? 0.05 : 0.1,
      messages: [
        {
          role: "system",
          content: promptConfig.system
        },
        {
          role: "user",
          content: `${promptConfig.user}${sourceContext}`
        }
      ]
    });

    const parsed = parseTutorResponse(raw);
    return NextResponse.json(parsed satisfies TutorResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate tutor response.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

