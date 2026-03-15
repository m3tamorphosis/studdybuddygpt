import { NextResponse } from "next/server";

import { extractTextFromPdf } from "@/lib/pdf";

const MAX_RECOMMENDED_SIZE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF uploads are supported." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const text = await extractTextFromPdf(Buffer.from(arrayBuffer));

    if (!text) {
      return NextResponse.json(
        {
          error:
            "No readable text was found in the PDF. Best results come from mostly text-based PDFs around 5 MB to 15 MB."
        },
        { status: 400 }
      );
    }

    const warning = file.size > MAX_RECOMMENDED_SIZE_BYTES
      ? "This PDF is larger than the recommended 15 MB size. It may still work, but smaller text-based PDFs usually give better results."
      : null;

    return NextResponse.json({ text, warning });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
