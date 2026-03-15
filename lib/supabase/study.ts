"use client";

import type { User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient, getSupabaseStorageBucket } from "@/lib/supabase/client";
import type { FlashcardItem, QuizQuestion, TutorResponse } from "@/lib/groq";

export type StoredPdfDocument = {
  id: string;
  userId: string;
  fileName: string;
  contentHash: string;
  storagePath: string | null;
};

type StudyArtifactType = "summary" | "key_terms" | "study_notes" | "flashcards" | "quiz" | "ask";

type StoredArtifacts = {
  summary?: TutorResponse | null;
  keyTerms?: TutorResponse | null;
  studyNotes?: TutorResponse | null;
  flashcards?: FlashcardItem[];
  quiz?: QuizQuestion[];
  ask?: TutorResponse | null;
};

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

export async function ensureProfile(user: User) {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  if (!supabase) {
    return;
  }

  await db.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null
    },
    { onConflict: "id" }
  );
}

export async function uploadPdfToStorage(user: User, file: File, contentHash: string) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  const storagePath = `${user.id}/${contentHash}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(getSupabaseStorageBucket()).upload(storagePath, file, {
    upsert: true,
    contentType: file.type || "application/pdf"
  });

  if (error) {
    throw error;
  }

  return storagePath;
}

export async function ensurePdfDocument(params: {
  user: User;
  fileName: string;
  text: string;
  file?: File;
}) {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  if (!supabase) {
    return null;
  }

  const { user, fileName, text, file } = params;
  await ensureProfile(user);

  const contentHash = await sha256(text);
  let storagePath: string | null = null;

  const { data: existing } = await db
    .from("pdf_documents")
    .select("id, user_id, file_name, content_hash, storage_path")
    .eq("user_id", user.id)
    .eq("content_hash", contentHash)
    .maybeSingle();

  if (file) {
    try {
      storagePath = await uploadPdfToStorage(user, file, contentHash);
    } catch {
      storagePath = existing?.storage_path ?? null;
    }
  } else {
    storagePath = existing?.storage_path ?? null;
  }

  const { data, error } = await db
    .from("pdf_documents")
    .upsert(
      {
        user_id: user.id,
        file_name: fileName,
        content_hash: contentHash,
        extracted_text: text,
        storage_path: storagePath
      },
      { onConflict: "user_id,content_hash" }
    )
    .select("id, user_id, file_name, content_hash, storage_path")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    userId: data.user_id,
    fileName: data.file_name,
    contentHash: data.content_hash,
    storagePath: data.storage_path
  } satisfies StoredPdfDocument;
}

export async function saveStudyArtifact(params: {
  userId: string;
  documentId: string;
  artifactType: StudyArtifactType;
  payload: Record<string, unknown>;
}) {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  if (!supabase) {
    return;
  }

  const { error } = await db.from("study_artifacts").upsert(
    {
      user_id: params.userId,
      document_id: params.documentId,
      artifact_type: params.artifactType,
      payload: params.payload
    },
    { onConflict: "user_id,document_id,artifact_type" }
  );

  if (error) {
    throw error;
  }
}

export async function loadStudyArtifacts(params: { userId: string; documentId: string }) {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  if (!supabase) {
    return {} as StoredArtifacts;
  }

  const { data, error } = await db
    .from("study_artifacts")
    .select("artifact_type, payload")
    .eq("user_id", params.userId)
    .eq("document_id", params.documentId);

  if (error || !data) {
    return {} as StoredArtifacts;
  }

  const artifacts: StoredArtifacts = {};

  for (const item of data as Array<{ artifact_type: string; payload: any }>) {
    if (item.artifact_type === "summary") {
      artifacts.summary = item.payload as TutorResponse;
    }

    if (item.artifact_type === "key_terms") {
      artifacts.keyTerms = item.payload as TutorResponse;
    }

    if (item.artifact_type === "study_notes") {
      artifacts.studyNotes = item.payload as TutorResponse;
    }

    if (item.artifact_type === "flashcards") {
      artifacts.flashcards = (item.payload?.cards ?? []) as FlashcardItem[];
    }

    if (item.artifact_type === "quiz") {
      artifacts.quiz = (item.payload?.questions ?? []) as QuizQuestion[];
    }

    if (item.artifact_type === "ask") {
      artifacts.ask = item.payload as TutorResponse;
    }
  }

  return artifacts;
}

export async function saveQuizAttempt(params: {
  userId: string;
  documentId: string | null;
  questionCount: number;
  score: number;
  totalQuestions: number;
  answers: Record<string, unknown>;
}) {
  const supabase = getSupabaseBrowserClient();
  const db = supabase as any;

  if (!supabase) {
    return;
  }

  const { error } = await db.from("quiz_attempts").insert({
    user_id: params.userId,
    document_id: params.documentId,
    question_count: params.questionCount,
    score: params.score,
    total_questions: params.totalQuestions,
    answers: params.answers
  });

  if (error) {
    throw error;
  }
}
