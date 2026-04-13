const API_BASE = "http://localhost:4000/api";

function parseErrorMessage(text: string, status: number) {
  if (!text) {
    return `Request failed with status ${status}`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? text;
  } catch {
    return text;
  }
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseErrorMessage(text, response.status));
  }

  return (await response.json()) as T;
}
