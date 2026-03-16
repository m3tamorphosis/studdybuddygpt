"use client";

import type { StoredPdfDocument } from "@/lib/supabase/study";

const PDF_TEXT_KEY = "studybuddy-pdf-text";
const PDF_NAME_KEY = "studybuddy-pdf-name";
const PDF_PREVIEW_KEY = "studybuddy-pdf-preview";
const PDF_RESULTS_KEY = "studybuddy-pdf-results";
const PDF_DOCUMENT_KEY = "studybuddy-pdf-document";
const RECENT_PDFS_KEY = "studybuddy-recent-pdfs";
const RECENT_PDF_PAYLOADS_KEY = "studybuddy-recent-pdf-payloads";
const MAX_RECENT_PDFS = 3;

export type RecentPdfItem = {
  id: string;
  fileName: string;
  text: string;
  previewUrl: string;
  savedAt: number;
};

export type PdfStudyResults = {
  quiz?: unknown[];
  flashcards?: unknown[];
  summary?: { explanation: string; example: string; summary: string } | null;
  keyTerms?: { explanation: string; example: string; summary: string } | null;
  studyNotes?: { explanation: string; example: string; summary: string } | null;
  ask?: { explanation: string; example: string; summary: string } | null;
  activeView?: "quiz" | "flashcards" | "summary" | "key-terms" | "study-notes" | "ask" | null;
};

type StoredRecentPdfMeta = {
  id: string;
  fileName: string;
  savedAt: number;
};

type StoredRecentPdfPayload = {
  id: string;
  text: string;
  previewUrl: string;
};

type PdfSessionState = {
  text: string;
  fileName: string;
  previewUrl: string;
  document: StoredPdfDocument | null;
};

function getStorageSafeJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);

  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setSessionItemSafe(key: string, value: string) {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function setLocalItemSafe(key: string, value: string) {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function getRecentPdfMeta() {
  return getStorageSafeJson<StoredRecentPdfMeta[]>(RECENT_PDFS_KEY, []);
}

function getRecentPdfPayloads() {
  return getStorageSafeJson<StoredRecentPdfPayload[]>(RECENT_PDF_PAYLOADS_KEY, []);
}

export function savePdfSession(text: string, fileName: string, previewUrl = "", document: StoredPdfDocument | null = null) {
  if (typeof window === "undefined") {
    return;
  }

  const currentFileName = sessionStorage.getItem(PDF_NAME_KEY) ?? "";
  const currentText = sessionStorage.getItem(PDF_TEXT_KEY) ?? "";

  if ((currentFileName && currentFileName !== fileName) || (currentText && currentText !== text)) {
    sessionStorage.removeItem(PDF_RESULTS_KEY);
  }

  setSessionItemSafe(PDF_TEXT_KEY, text);
  setSessionItemSafe(PDF_NAME_KEY, fileName);

  if (previewUrl) {
    if (!setSessionItemSafe(PDF_PREVIEW_KEY, previewUrl)) {
      sessionStorage.removeItem(PDF_PREVIEW_KEY);
    }
  } else {
    sessionStorage.removeItem(PDF_PREVIEW_KEY);
  }

  if (document) {
    setSessionItemSafe(PDF_DOCUMENT_KEY, JSON.stringify(document));
  } else {
    sessionStorage.removeItem(PDF_DOCUMENT_KEY);
  }

  const id = `${fileName}-${Date.now()}`;
  const recentMeta = getRecentPdfMeta().filter((item) => item.fileName !== fileName);
  const nextMeta: StoredRecentPdfMeta[] = [
    {
      id,
      fileName,
      savedAt: Date.now()
    },
    ...recentMeta
  ].slice(0, MAX_RECENT_PDFS);

  const nextPayloads: StoredRecentPdfPayload[] = [
    {
      id,
      text,
      previewUrl
    },
    ...getRecentPdfPayloads().filter((item) => item.id !== id)
  ]
    .filter((item) => nextMeta.some((meta) => meta.id === item.id))
    .slice(0, MAX_RECENT_PDFS);

  setLocalItemSafe(RECENT_PDFS_KEY, JSON.stringify(nextMeta));
  setSessionItemSafe(RECENT_PDF_PAYLOADS_KEY, JSON.stringify(nextPayloads));
}

export function removeRecentPdfSession(id: string) {
  if (typeof window === "undefined") {
    return;
  }

  const nextMeta = getRecentPdfMeta().filter((item) => item.id !== id);
  const nextPayloads = getRecentPdfPayloads().filter((item) => item.id !== id);

  if (nextMeta.length) {
    setLocalItemSafe(RECENT_PDFS_KEY, JSON.stringify(nextMeta));
  } else {
    localStorage.removeItem(RECENT_PDFS_KEY);
  }

  if (nextPayloads.length) {
    setSessionItemSafe(RECENT_PDF_PAYLOADS_KEY, JSON.stringify(nextPayloads));
  } else {
    sessionStorage.removeItem(RECENT_PDF_PAYLOADS_KEY);
  }
}

export function savePdfDocument(document: StoredPdfDocument | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (document) {
    setSessionItemSafe(PDF_DOCUMENT_KEY, JSON.stringify(document));
  } else {
    sessionStorage.removeItem(PDF_DOCUMENT_KEY);
  }
}

export function savePdfStudyResults(results: PdfStudyResults) {
  if (typeof window === "undefined") {
    return;
  }

  setSessionItemSafe(PDF_RESULTS_KEY, JSON.stringify(results));
}

export function getPdfStudyResults() {
  return getStorageSafeJson<PdfStudyResults>(PDF_RESULTS_KEY, {});
}

export function clearPdfSession() {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(PDF_TEXT_KEY);
  sessionStorage.removeItem(PDF_NAME_KEY);
  sessionStorage.removeItem(PDF_PREVIEW_KEY);
  sessionStorage.removeItem(PDF_RESULTS_KEY);
  sessionStorage.removeItem(PDF_DOCUMENT_KEY);
}

export function getPdfSession(): PdfSessionState {
  if (typeof window === "undefined") {
    return { text: "", fileName: "", previewUrl: "", document: null };
  }

  return {
    text: sessionStorage.getItem(PDF_TEXT_KEY) ?? "",
    fileName: sessionStorage.getItem(PDF_NAME_KEY) ?? "",
    previewUrl: sessionStorage.getItem(PDF_PREVIEW_KEY) ?? "",
    document: getStorageSafeJson<StoredPdfDocument | null>(PDF_DOCUMENT_KEY, null)
  };
}

export function getRecentPdfSessions() {
  if (typeof window === "undefined") {
    return [] as RecentPdfItem[];
  }

  const meta = getRecentPdfMeta();
  const payloads = getRecentPdfPayloads();

  return meta
    .map((item) => {
      const payload = payloads.find((candidate) => candidate.id === item.id);

      if (!payload?.text) {
        return null;
      }

      return {
        id: item.id,
        fileName: item.fileName,
        text: payload.text,
        previewUrl: payload.previewUrl,
        savedAt: item.savedAt
      } satisfies RecentPdfItem;
    })
    .filter((item): item is RecentPdfItem => Boolean(item));
}

export function restorePdfSession(item: RecentPdfItem) {
  if (typeof window === "undefined") {
    return;
  }

  setSessionItemSafe(PDF_TEXT_KEY, item.text);
  setSessionItemSafe(PDF_NAME_KEY, item.fileName);

  if (item.previewUrl) {
    setSessionItemSafe(PDF_PREVIEW_KEY, item.previewUrl);
  } else {
    sessionStorage.removeItem(PDF_PREVIEW_KEY);
  }

  sessionStorage.removeItem(PDF_RESULTS_KEY);
  sessionStorage.removeItem(PDF_DOCUMENT_KEY);
}
