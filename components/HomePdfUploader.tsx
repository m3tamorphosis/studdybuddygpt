"use client";

import { PdfUploader } from "@/components/PdfUploader";

export function HomePdfUploader() {
  return <PdfUploader compact onTextExtracted={() => {}} redirectTo="/pdf-study" />;
}
