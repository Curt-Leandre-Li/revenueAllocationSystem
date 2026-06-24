import type { ApiError } from "../domain/api";

interface BackendUnavailableStateProps {
  apiBaseUrl: string;
  error?: ApiError;
  modeLabel?: string;
}

export function BackendUnavailableState({
  apiBaseUrl,
  error,
  modeLabel = "后端未连接",
}: BackendUnavailableStateProps) {
  return (
    <section className="backendUnavailable compact" aria-live="polite">
      <div className="backendUnavailableSummary">
        <span className="stateEyebrow">{modeLabel}</span>
        <h2>后端未启动或 API Base 配置错误</h2>
        <p>
          当前页面保留操作骨架，但不会使用 mock 或 fallback 伪造成业务成功。后端连接后会重新读取接口字段、按钮守卫和图表 DTO。
        </p>
      </div>
      <div className="backendUnavailableInline">
        <span>API Base: {apiBaseUrl}</span>
        <span>{error?.errorMessage ?? "正在连接后端"}</span>
      </div>
      <details className="backendUnavailableDetails">
        <summary>查看错误详情</summary>
        <dl>
          <div>
            <dt>建议</dt>
            <dd>{error?.repairSuggestion ?? "确认后端服务已启动，并检查 API Base URL。"}</dd>
          </div>
          {error?.detail ? (
            <div>
            <dt>详情</dt>
            <dd>{error.detail}</dd>
            </div>
          ) : null}
        </dl>
      </details>
    </section>
  );
}
