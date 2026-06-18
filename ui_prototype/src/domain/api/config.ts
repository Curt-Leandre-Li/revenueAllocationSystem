const DEFAULT_API_BASE_URL = "/api/v1";
const API_PREFIX = "/api/v1";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function readEnvString(name: string) {
  return String(import.meta.env[name] ?? "").trim();
}

export function getDvasApiBaseUrl() {
  return trimTrailingSlash(
    readEnvString("VITE_API_BASE_URL") ||
      readEnvString("VITE_DVAS_API_BASE_URL") ||
      DEFAULT_API_BASE_URL,
  );
}

export function getDvasApiRootUrl() {
  const baseUrl = getDvasApiBaseUrl();
  return baseUrl.endsWith(API_PREFIX) ? baseUrl : `${baseUrl}${API_PREFIX}`;
}

export function isDvasBackendEnabled() {
  return readEnvString("VITE_DVAS_USE_BACKEND").toLowerCase() !== "false";
}

export function getDvasApiConfig() {
  return {
    baseUrl: getDvasApiBaseUrl(),
    apiRootUrl: getDvasApiRootUrl(),
    useBackend: isDvasBackendEnabled(),
  };
}
