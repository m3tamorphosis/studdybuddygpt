type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqCompletionOptions = {
  messages: GroqMessage[];
  temperature?: number;
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
const MAX_SOURCE_CONTEXT_CHARS = 9000;
const MAX_SUMMARY_CONTEXT_CHARS = 5000;

export async function createGroqCompletion({
  messages,
  temperature = 0.7
}: GroqCompletionOptions) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable.");
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature,
      messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      try {
        const parsed = JSON.parse(errorText) as {
          error?: { message?: string };
        };
        const message = parsed.error?.message ?? "Rate limit reached. Please wait and try again.";
        const retryMatch = message.match(/try again in\s+([\d.]+)s/i);

        if (retryMatch) {
          const seconds = Math.ceil(Number(retryMatch[1]));
          throw new Error(`Groq rate limit reached. Wait about ${seconds} seconds, then try again.`);
        }

        throw new Error("Groq rate limit reached. Please wait a moment, then try again.");
      } catch {
        throw new Error("Groq rate limit reached. Please wait a moment, then try again.");
      }
    }

    throw new Error(`Groq API request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Groq API returned an empty response.");
  }

  return content;
}

function extractBalancedJson(text: string) {
  const startIndices = [text.indexOf("{"), text.indexOf("[")].filter((index) => index >= 0);

  if (startIndices.length === 0) {
    return text;
  }

  const start = Math.min(...startIndices);
  const opening = text[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return text.slice(start);
}

function quoteLooseObjectKeys(candidate: string) {
  return candidate.replace(/([{,]\s*)([A-Za-z0-9_ -]+)(\s*:)/g, '$1"$2"$3');
}

function stripComments(candidate: string) {
  return candidate
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function cleanJsonCandidate(candidate: string) {
  return candidate
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u0000-\u0019]+/g, " ")
    .trim();
}

function parseJsonWithRepairs<T>(rawCandidate: string): T {
  const attempts = [
    rawCandidate,
    extractBalancedJson(rawCandidate),
    quoteLooseObjectKeys(extractBalancedJson(rawCandidate)),
    quoteLooseObjectKeys(stripComments(extractBalancedJson(rawCandidate)))
  ].map((candidate) => cleanJsonCandidate(candidate));

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as T;
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Invalid JSON returned by model.";
  throw new Error(`The AI returned malformed JSON. ${message}`);
}

export function extractJson<T>(raw: string): T {
  const match = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/```([\s\S]*?)```/);
  const fencedCandidate = match ? match[1] : raw;
  const objectCandidateMatch = fencedCandidate.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  const candidate = objectCandidateMatch ? objectCandidateMatch[0] : fencedCandidate;
  const cleanedCandidate = cleanJsonCandidate(candidate);

  return parseJsonWithRepairs<T>(cleanedCandidate);
}

export type TutorResponse = {
  explanation: string;
  example: string;
  summary: string;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
};

export type FlashcardItem = {
  front: string;
  back: string;
};

function stripTutorLabel(value: string) {
  return value
    .replace(/^\s*["']?\*{0,2}\s*(explanation|example|summary|meaning|context|quick answer)\s*\*{0,2}["']?\s*:?\s*/i, "")
    .replace(/(^|\n)\s*["']?\*{0,2}\s*(explanation|example|summary|meaning|context|quick answer)\s*\*{0,2}["']?\s*:?\s*/gi, "$1")
    .replace(/^\s*(explanation|example|summary|meaning|context|quick answer)\s*:?\s*/i, "")
    .replace(/^\s*["']+\s*/, "")
    .replace(/\s*["']+\s*:\s*/g, ": ")
    .replace(/\*\*/g, "")
    .trim();
}

function normalizeTutorField(value: unknown): string {
  if (typeof value === "string") {
    return stripTutorLabel(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTutorField(item)).filter(Boolean).join("\n");
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => `${key}: ${normalizeTutorField(entryValue)}`)
      .join("\n");
  }

  if (value == null) {
    return "";
  }

  return String(value);
}

export function parseTutorResponse(raw: string): TutorResponse {
  try {
    const parsed = extractJson<Record<string, unknown>>(raw);
    const explanation = normalizeTutorField(parsed.explanation);
    const example = normalizeTutorField(parsed.example);
    const summary = normalizeTutorField(parsed.summary);

    return {
      explanation: explanation || example || summary || "No explanation section was returned.",
      example: example || summary || explanation || "No example section was returned.",
      summary: summary || explanation || example || "No summary section was returned."
    };
  } catch {
    const normalized = raw.replace(/\r/g, "").trim();
    const explanationMatch = normalized.match(
      /(?:^|\n)\s*(?:explanation)\s*:?\s*([\s\S]*?)(?=\n\s*(?:example|summary)\s*:|$)/i
    );
    const exampleMatch = normalized.match(
      /(?:^|\n)\s*(?:example)\s*:?\s*([\s\S]*?)(?=\n\s*(?:summary)\s*:|$)/i
    );
    const summaryMatch = normalized.match(
      /(?:^|\n)\s*(?:summary)\s*:?\s*([\s\S]*?)$/i
    );

    const explanation = stripTutorLabel(explanationMatch?.[1]?.trim() ?? "");
    const example = stripTutorLabel(exampleMatch?.[1]?.trim() ?? "");
    const summary = stripTutorLabel(summaryMatch?.[1]?.trim() ?? "");

    if (explanation || example || summary) {
      return {
        explanation: explanation || example || summary || "No explanation section was returned.",
        example: example || summary || explanation || "No example section was returned.",
        summary: summary || explanation || example || "No summary section was returned."
      };
    }

    const paragraphs = normalized
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      explanation: paragraphs[0] ?? normalized,
      example: paragraphs[1] ?? "No example section was returned.",
      summary: paragraphs[2] ?? "No summary section was returned."
    };
  }
}

function normalizeWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function splitIntoChunks(text: string, chunkSize = 1600) {
  const cleaned = text.replace(/\r/g, "").trim();

  if (!cleaned) {
    return [];
  }

  const paragraphs = cleaned.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const part = paragraph.trim();

    if (!part) {
      continue;
    }

    if (`${current}\n\n${part}`.length > chunkSize && current) {
      chunks.push(current.trim());
      current = part;
      continue;
    }

    current = current ? `${current}\n\n${part}` : part;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

function scoreChunk(chunk: string, queryTerms: string[]) {
  if (queryTerms.length === 0) {
    return 0;
  }

  const haystack = chunk.toLowerCase();
  let score = 0;

  for (const term of queryTerms) {
    if (haystack.includes(term)) {
      score += term.length > 6 ? 3 : 2;
    }
  }

  return score;
}

export function buildSourceContext(sourceText?: string, query?: string, maxChars = MAX_SOURCE_CONTEXT_CHARS) {
  if (!sourceText?.trim()) {
    return "";
  }

  const chunks = splitIntoChunks(sourceText);
  const queryTerms = normalizeWords(query ?? "");
  const intro = chunks.slice(0, 2);
  const ranked = chunks
    .map((chunk, index) => ({
      chunk,
      index,
      score: scoreChunk(chunk, queryTerms)
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 4)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.chunk);

  const selectedChunks = Array.from(new Set([...intro, ...ranked])).slice(0, 5);
  const selectedText = selectedChunks.join("\n\n---\n\n").slice(0, maxChars);

  return `\n\nUse the following extracted PDF material as the only primary source. Answer from this material as accurately as possible. If the material does not contain the answer, say that clearly. Do not invent facts that are not supported by the PDF.\n\nRelevant PDF material:\n${selectedText}`;
}

export function buildSummarySourceContext(sourceText?: string, query?: string) {
  return buildSourceContext(sourceText, query, MAX_SUMMARY_CONTEXT_CHARS);
}


function stripListMarker(value: string) {
  return value.replace(/^[-*\d.)\s]+/, "").trim();
}

export function parseQuizResponse(raw: string): QuizQuestion[] {
  try {
    const parsedObject = extractJson<{ questions?: QuizQuestion[] }>(raw);

    if (Array.isArray(parsedObject.questions) && parsedObject.questions.length > 0) {
      return parsedObject.questions;
    }
  } catch {
    // Fall through to more tolerant recovery.
  }

  try {
    const parsedArray = extractJson<QuizQuestion[]>(raw);

    if (Array.isArray(parsedArray) && parsedArray.length > 0) {
      return parsedArray;
    }
  } catch {
    // Fall through to plain-text recovery.
  }

  const normalized = raw.replace(/\r/g, "").trim();
  const blockMatches = Array.from(
    normalized.matchAll(/(?:^|\n)\s*(?:question\s*\d+|\d+[.)])\s*[:.-]?\s*([\s\S]*?)(?=(?:\n\s*(?:question\s*\d+|\d+[.)])\s*[:.-]?)|$)/gi)
  );

  const recovered = blockMatches
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean)
    .map((block) => {
      const lines = block
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        return null;
      }

      const questionLine = lines[0].replace(/^question\s*[:.-]?\s*/i, "").trim();
      const answerLine = lines.find((line) => /^answer\s*:/i.test(line));
      const explanationLineIndex = lines.findIndex((line) => /^explanation\s*:/i.test(line));

      const optionLines = lines
        .slice(1)
        .filter((line) => !/^answer\s*:/i.test(line) && !/^explanation\s*:/i.test(line))
        .flatMap((line) => {
          const inlineOptionMatches = Array.from(line.matchAll(/(?:^|\s)([A-D])[.)]\s*([^A-D].*?)(?=(?:\s+[A-D][.)]\s)|$)/g));

          if (inlineOptionMatches.length > 0) {
            return inlineOptionMatches.map((optionMatch) => optionMatch[2].trim()).filter(Boolean);
          }

          return [stripListMarker(line)];
        })
        .filter(Boolean)
        .slice(0, 4);

      let answer = answerLine ? answerLine.replace(/^answer\s*:/i, "").trim() : "";

      if (/^[A-D]$/i.test(answer)) {
        const answerIndex = answer.toUpperCase().charCodeAt(0) - 65;
        answer = optionLines[answerIndex] ?? answer;
      }

      const explanation = explanationLineIndex >= 0
        ? lines.slice(explanationLineIndex).join(" ").replace(/^explanation\s*:/i, "").trim()
        : "No explanation was returned.";

      if (!questionLine || optionLines.length < 2 || !answer) {
        return null;
      }

      return {
        question: questionLine,
        options: optionLines,
        answer,
        explanation
      } satisfies QuizQuestion;
    })
    .filter((item): item is QuizQuestion => Boolean(item));

  if (recovered.length > 0) {
    return recovered;
  }

  throw new Error("The AI returned malformed JSON. Quiz content could not be recovered.");
}

export function parseFlashcardResponse(raw: string): FlashcardItem[] {
  try {
    const parsed = extractJson<{ cards?: FlashcardItem[] }>(raw);

    if (Array.isArray(parsed.cards) && parsed.cards.length > 0) {
      return parsed.cards;
    }
  } catch {
    // Fall through to plain-text recovery.
  }

  const sections = raw
    .split(/(?:^|\n)\s*(?:flashcard\s*\d+|card\s*\d+|\d+[.)])\s*[:.-]?/i)
    .map((section) => section.trim())
    .filter(Boolean);

  const recovered = sections
    .map((section) => {
      const frontMatch = section.match(/front\s*:\s*([\s\S]*?)(?=\n\s*back\s*:|$)/i);
      const backMatch = section.match(/back\s*:\s*([\s\S]*?)$/i);
      const front = frontMatch?.[1]?.trim() ?? "";
      const back = backMatch?.[1]?.trim() ?? "";

      if (!front || !back) {
        return null;
      }

      return { front, back } satisfies FlashcardItem;
    })
    .filter((item): item is FlashcardItem => Boolean(item));

  if (recovered.length > 0) {
    return recovered;
  }

  throw new Error("The AI returned malformed JSON. Flashcard content could not be recovered.");
}






