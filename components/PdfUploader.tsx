"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { parseApiResponse } from "@/lib/api";
import {
  getRecentPdfSessions,
  type RecentPdfItem,
  restorePdfSession,
  savePdfSession
} from "@/lib/pdf-session";
import { ensurePdfDocument } from "@/lib/supabase/study";

type PdfUploaderProps = {
  onTextExtracted: (text: string, fileName: string) => void;
  redirectTo?: string;
  compact?: boolean;
  canSummarize?: boolean;
  onSummarize?: () => void;
  summarizing?: boolean;
};

const RECOMMENDED_MIN_MB = 5;
const RECOMMENDED_MAX_MB = 15;
const ABSOLUTE_WARNING_MB = 20;

export function PdfUploader({
  onTextExtracted,
  redirectTo,
  compact = false,
  canSummarize = false,
  onSummarize,
  summarizing = false
}: PdfUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<RecentPdfItem[]>([]);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    setRecentFiles(getRecentPdfSessions());
  }, []);

  async function readPreviewUrl(file: File) {
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : "");
      };

      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  function getFileAdvice(file: File) {
    const sizeMb = file.size / (1024 * 1024);

    if (sizeMb > ABSOLUTE_WARNING_MB) {
      return "This PDF is quite large. Best results usually come from mostly text-based PDFs around 5 MB to 15 MB.";
    }

    if (sizeMb < RECOMMENDED_MIN_MB) {
      return "This PDF is under 5 MB, which is usually fine if it is mostly text-based.";
    }

    if (sizeMb <= RECOMMENDED_MAX_MB) {
      return "Recommended range: this PDF is within the 5 MB to 15 MB sweet spot for best results.";
    }

    return "This PDF is above the recommended 15 MB size. It can still work, but smaller text-based PDFs usually perform better.";
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError(null);

    try {
      const previewUrl = await readPreviewUrl(file);
      const response = await fetch("/api/pdf", {
        method: "POST",
        body: formData
      });

      const data = await parseApiResponse<{ error?: string; text?: string; warning?: string }>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to process the PDF.");
      }

      if (!data.text) {
        throw new Error("The PDF route did not return extracted text.");
      }

      let persistedDocument = null;

      if (user) {
        try {
          persistedDocument = await ensurePdfDocument({
            user,
            fileName: file.name,
            text: data.text,
            file
          });
        } catch {
          persistedDocument = null;
        }
      }

      setFileName(file.name);
      savePdfSession(data.text, file.name, previewUrl, persistedDocument);
      setRecentFiles(getRecentPdfSessions());
      onTextExtracted(data.text, file.name);

      if (redirectTo) {
        router.push(redirectTo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process the PDF.");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  function handleOpenRecent(item: RecentPdfItem) {
    restorePdfSession(item);
    setFileName(item.fileName);
    setError(null);
    onTextExtracted(item.text, item.fileName);

    if (redirectTo) {
      router.push(redirectTo);
    }
  }

  return (
    <div
      className={[
        compact
          ? "rounded-2xl border border-[color:var(--field-border)] bg-[color:var(--field-bg)] p-4"
          : "rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4"
      ].join(" ")}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          {compact ? (
            <>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                Upload PDF
              </p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
                Add your file and open the study workspace.
              </p>
              <p className="mt-2 text-xs leading-6 text-[color:var(--text-muted)]">
                Best results come from text-based PDFs around 5 MB to 15 MB.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                PDF Study Material
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                Upload lecture notes or a chapter PDF and the tutor, quiz, flashcards, key terms, and study notes will use it as the main source.
              </p>
              <div className="mt-3 space-y-1 text-sm text-[color:var(--text-muted)]">
                <p>Best results usually come from mostly text-based PDFs around 5 MB to 15 MB.</p>
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            {canSummarize && onSummarize ? (
              <button
                className="primary-button"
                disabled={loading || summarizing}
                onClick={onSummarize}
                type="button"
              >
                {summarizing ? "Summarizing..." : "Summarize PDF"}
              </button>
            ) : null}
            <label className="secondary-button cursor-pointer px-6 py-3 text-base font-semibold">
              {loading ? "Reading PDF..." : "Upload PDF"}
              <input accept="application/pdf" className="hidden" onChange={handleFileChange} type="file" />
            </label>
          </div>
        </div>
      </div>

      {fileName ? (
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">
          Current file: <span className="font-medium text-[color:var(--text-main)]">{fileName}</span>
        </p>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-[color:var(--field-border)] bg-[color:var(--field-bg)] px-4 py-3 text-sm text-[color:var(--text-main)]">
          {error}
        </div>
      ) : null}

      {!compact && recentFiles.length ? (
        <div className="mt-4 rounded-2xl border border-[color:var(--field-border)] bg-[color:var(--field-bg)] p-4 xl:min-h-[9.5rem]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
            Recent Uploads
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {recentFiles.map((item) => (
              <button
                key={`${item.fileName}-${item.savedAt}`}
                className="secondary-button px-4 py-2 text-sm"
                onClick={() => handleOpenRecent(item)}
                type="button"
              >
                {item.fileName}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
