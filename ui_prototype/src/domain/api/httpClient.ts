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

  const envelope = (await response.json()) as ApiEnvelope<T>;
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
