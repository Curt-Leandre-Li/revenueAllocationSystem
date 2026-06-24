import { getDvasApiRootUrl } from "./config";
import {
  DvasApiError,
  apiErrorFromEnvelope,
  type ApiErrorEnvelope,
} from "./errors";

export interface ApiEnvelope<T> extends ApiErrorEnvelope {
  success: boolean;
  data?: T;
}

export interface TablePage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null;
  bodyJson?: unknown;
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { bodyJson, headers, ...requestOptions } = options;
  const response = await fetch(`${getDvasApiRootUrl()}${endpoint}`, {
    ...requestOptions,
    body: bodyJson === undefined ? options.body : JSON.stringify(bodyJson),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const responseText = await response.text();

  if (isHtmlResponse(contentType, responseText)) {
    throw new DvasApiError(
      apiErrorFromEnvelope(
        {
          success: false,
          code: "DVAS_API_BASE_MISCONFIGURED",
          message:
            "当前 API 请求返回 HTML，可能是 API Base 指向了前端开发服务器。请检查 .env.local 或 Vite proxy。",
          error: {
            code: "DVAS_API_BASE_MISCONFIGURED",
            field: "API Base",
            detail: {
              api_root_url: getDvasApiRootUrl(),
              content_type: contentType || "unknown",
            },
          },
          field_errors: [
            {
              field: "API Base",
              reason: "后端未启动或 API Base 配置错误；请指向 http://127.0.0.1:8000/api/v1。",
            },
          ],
        },
        response.status,
      ),
    );
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = JSON.parse(responseText) as ApiEnvelope<T>;
  } catch (error) {
    throw new DvasApiError(
      apiErrorFromEnvelope(
        {
          success: false,
          code: "DVAS_INVALID_JSON_RESPONSE",
          message: "后端响应不是标准 JSON 信封",
          error: {
            detail: error instanceof Error ? error.message : String(error),
          },
        },
        response.status,
      ),
    );
  }
  if (!response.ok || !envelope.success) {
    throw new DvasApiError(apiErrorFromEnvelope(envelope, response.status));
  }
  if (envelope.data === undefined) {
    throw new DvasApiError(
      apiErrorFromEnvelope(
        {
          success: false,
          code: "DVAS_EMPTY_RESPONSE",
          message: "后端响应缺少 data 字段",
        },
        response.status,
        envelope,
      ),
    );
  }
  return envelope.data;
}

function isHtmlResponse(contentType: string, body: string) {
  const normalizedType = contentType.toLowerCase();
  const trimmedBody = body.trimStart().toLowerCase();
  return (
    normalizedType.includes("text/html") ||
    trimmedBody.startsWith("<!doctype") ||
    trimmedBody.startsWith("<html")
  );
}
