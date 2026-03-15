import pdfParse from "pdf-parse/lib/pdf-parse.js";

const MIN_EXTRACTED_TEXT_LENGTH = 120;

export async function extractTextFromPdf(buffer: Buffer) {
  try {
    const data = await pdfParse(buffer);
    const cleanedText = data.text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    if (!cleanedText || cleanedText.length < MIN_EXTRACTED_TEXT_LENGTH) {
      throw new Error(
        "This PDF appears to be image-based or scanned and does not contain enough selectable text. Best results come from text-based PDFs around 5 MB to 15 MB. OCR is not enabled yet, so please use a text-based PDF or re-save the file with selectable text."
      );
    }

    return cleanedText;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF parsing error.";
    const lowered = message.toLowerCase();

    if (lowered.includes("image-based or scanned")) {
      throw error;
    }

    if (lowered.includes("xref")) {
      throw new Error(
        "This PDF could not be read properly. Try downloading it again or re-saving it as a standard PDF, then upload it again."
      );
    }

    throw new Error(
      "The uploaded PDF could not be parsed. Best results come from mostly text-based PDFs around 5 MB to 15 MB. Try a different PDF or re-export this file."
    );
  }
}

