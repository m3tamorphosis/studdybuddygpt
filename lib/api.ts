export async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  const cleanText = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  throw new Error(
    cleanText || "The server returned a non-JSON response. Check the API route for a runtime error."
  );
}
