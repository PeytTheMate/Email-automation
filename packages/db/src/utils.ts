export function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function toJson(value: unknown): string {
  return JSON.stringify(value);
}

export function nowIso() {
  return new Date().toISOString();
}
