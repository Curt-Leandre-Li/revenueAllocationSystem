export interface ApiError {
  errorCode: string;
  errorMessage: string;
  errorField?: string;
  detail?: string;
  repairSuggestion?: string;
  raw: unknown;
  retryable: boolean;
  status?: number;
}

export interface ApiFieldError {
  field?: string;
  reason?: string;
}

export interface ApiErrorEnvelope {
  success?: boolean;
  code?: string;
  message?: string;
  trace_id?: string | null;
  field_errors?: ApiFieldError[];
}

export class DvasApiError extends Error {
  apiError: ApiError;

  constructor(apiError: ApiError) {
    super(apiError.errorMessage);
    this.name = "DvasApiError";
    this.apiError = apiError;
  }
}

export function apiErrorFromEnvelope(
  envelope: ApiErrorEnvelope,
  status: number,
  raw: unknown = envelope,
): ApiError {
  const firstFieldError = envelope.field_errors?.[0];
  const retryable = status === 0 || status >= 500;

  return {
    errorCode: envelope.code || "DVAS_API_ERROR",
    errorMessage: envelope.message || "后端请求失败",
    errorField: firstFieldError?.field,
    detail: envelope.trace_id ? `trace_id=${envelope.trace_id}` : undefined,
    repairSuggestion: firstFieldError?.reason,
    raw,
    retryable,
    status,
  };
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof DvasApiError) {
    return error.apiError;
  }

  if (error instanceof TypeError) {
    return {
      errorCode: "DVAS_NETWORK_ERROR",
      errorMessage: "后端 API 暂不可用",
      detail: error.message,
      repairSuggestion: "检查后端服务是否已启动，或继续使用本地模拟数据。",
      raw: error,
      retryable: true,
      status: 0,
    };
  }

  if (error instanceof Error) {
    return {
      errorCode: "DVAS_CLIENT_ERROR",
      errorMessage: error.message,
      raw: error,
      retryable: false,
    };
  }

  return {
    errorCode: "DVAS_UNKNOWN_ERROR",
    errorMessage: "未知错误",
    raw: error,
    retryable: false,
  };
}

export function formatApiError(error: unknown) {
  const normalized = normalizeApiError(error);
  const fieldText = normalized.errorField
    ? `（${normalized.errorField}: ${normalized.repairSuggestion ?? normalized.errorMessage}）`
    : "";
  return `${normalized.errorMessage}${fieldText}`;
}
