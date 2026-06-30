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
  error_code?: string;
  error_field?: string | null;
  error_message?: string;
  detail_json?: unknown;
  disabled_reason?: string;
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
  const retryable = status === 0 || status >= 500;
  const nestedMessage = envelope.error?.message ?? envelope.error_message;
  const topLevelMessage = envelope.message;
  const disabledReason = envelope.disabled_reason;
  const traceDetail = envelope.trace_id ? `trace_id=${envelope.trace_id}` : "";
  const nestedDetail =
    (envelope.error?.detail ?? envelope.detail_json) === undefined
      ? ""
      : `error.detail=${JSON.stringify(envelope.error?.detail ?? envelope.detail_json)}`;
  const detail = [traceDetail, nestedDetail].filter(Boolean).join(" ");

  return {
    errorCode: envelope.error?.code || envelope.error_code || envelope.code || "DVAS_API_ERROR",
    errorMessage: nestedMessage || topLevelMessage || disabledReason || "后端请求失败",
    errorField: envelope.error?.field ?? envelope.error_field ?? firstFieldError?.field,
    detail: detail || undefined,
    repairSuggestion: firstFieldError?.reason || disabledReason,
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
      repairSuggestion: "检查后端服务是否已启动；当前操作不会用前端 mock 伪造成功。",
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
      repairSuggestion: "检查前端 DTO 映射或请求参数；当前操作不会用前端 mock 伪造成功。",
      raw: error,
      retryable: false,
    };
  }

  return {
    errorCode: "DVAS_UNKNOWN_ERROR",
    errorMessage: "未知错误",
    detail: "无法识别的异常对象",
    repairSuggestion: "请查看后端服务状态；当前操作不会用前端 mock 伪造成功。",
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
