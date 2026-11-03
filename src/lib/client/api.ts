export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type ApiInit = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };

/** fetch wrapper for our JSON API: sends `json` as the body and throws ApiError with the server's message. */
export async function api<T>(path: string, { json, headers, ...init }: ApiInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: json === undefined ? headers : { "Content-Type": "application/json", ...headers },
    body: json === undefined ? init.body : JSON.stringify(json),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? `요청 실패 (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

/** URL of a project-relative file (e.g. "assets/a.jpg"); `version` busts the browser cache after re-renders. */
export function projectFileUrl(projectId: string, file: string, version?: string): string {
  const encoded = file.split("/").map(encodeURIComponent).join("/");
  const query = version ? `?v=${encodeURIComponent(version)}` : "";
  return `/api/files/projects/${projectId}/${encoded}${query}`;
}

/** Click-tracked redirect (/go/[id]) to the project's affiliate link. */
export function shortLinkUrl(projectId: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/go/${projectId}`;
}

export function downloadUrl(fileUrl: string, name: string): string {
  return `${fileUrl}${fileUrl.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}`;
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
