export interface ApiFieldError {
  field?: string;
  reason?: string;
}

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

export interface ApiErrorEnvelope {
  success?: boolean;
  code?: string;
  message?: string;
  trace_id?: string | null;
  field_errors?: ApiFieldError[];
  error?: {
    code?: string;
    field?: string | null;
    message?: string;
    detail?: unknown;
  };
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
  const fieldSummary = envelope.field_errors?.length
    ? envelope.field_errors
        .slice(0, 5)
        .map((item) => `${item.field ?? "字段"}: ${item.reason ?? "未通过校验"}`)
        .join("; ")
    : "";
  const detailParts = [
    envelope.trace_id ? `trace_id=${envelope.trace_id}` : "",
    fieldSummary ? `field_errors=${fieldSummary}` : "",
    envelope.error?.detail === undefined
      ? ""
      : `error.detail=${JSON.stringify(envelope.error.detail)}`,
  ].filter(Boolean);

  return {
    errorCode: envelope.error?.code || envelope.code || "DVAS_API_ERROR",
    errorMessage: envelope.error?.message || envelope.message || "后端请求失败",
    errorField: envelope.error?.field ?? firstFieldError?.field,
    detail: detailParts.join(" ") || undefined,
    repairSuggestion: firstFieldError?.reason,
    raw,
    retryable: status === 0 || status >= 500,
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
      errorMessage: "后端不可用，无法连接真实 PostgreSQL API",
      detail: error.message,
      repairSuggestion: "确认后端服务和 DATABASE_URL 已启动配置。",
      raw: error,
      retryable: true,
      status: 0,
    };
  }
  if (error instanceof Error) {
    return {
      errorCode: "DVAS_CLIENT_ERROR",
      errorMessage: error.message,
      detail: error.name,
      repairSuggestion: "检查前端请求参数和接口映射。",
      raw: error,
      retryable: false,
    };
  }
  return {
    errorCode: "DVAS_UNKNOWN_ERROR",
    errorMessage: "未知错误",
    detail: "无法识别的异常对象",
    raw: error,
    retryable: false,
  };
}

export function formatApiError(error: unknown) {
  const normalized = normalizeApiError(error);
  const fieldText = normalized.errorField
    ? `（${normalized.errorField}: ${normalized.repairSuggestion ?? normalized.errorMessage}）`
    : "";
  const detailText = normalized.detail ? ` ${normalized.detail}` : "";
  return `${normalized.errorMessage}${fieldText}${detailText}`;
}
