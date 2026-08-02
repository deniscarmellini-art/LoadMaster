export interface ApiHealth {
  status: "ok";
  service: "Sistema Logistico API";
  version: string;
  timestamp: string;
}

interface ApiErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number | undefined;

  constructor(
    code: string,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");

const isApiError = (value: unknown): value is ApiErrorPayload => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { success?: unknown; error?: unknown };
  if (candidate.success !== false || !candidate.error || typeof candidate.error !== "object") return false;
  const error = candidate.error as { code?: unknown; message?: unknown };
  return typeof error.code === "string" && typeof error.message === "string";
};

export const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Backend non raggiungibile";
    throw new ApiClientError("NETWORK_ERROR", message);
  }

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (isApiError(payload)) throw new ApiClientError(payload.error.code, payload.error.message, response.status);
    throw new ApiClientError("HTTP_ERROR", `Richiesta non riuscita (${response.status})`, response.status);
  }
  return payload as T;
};

export const checkApiHealth = (): Promise<ApiHealth> => apiRequest<ApiHealth>("/health");
