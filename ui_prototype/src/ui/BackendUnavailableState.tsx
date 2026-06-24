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
    <section className="backendUnavailable" aria-live="polite">
      <div>
        <span className="stateEyebrow">{modeLabel}</span>
        <h1>无法读取后端工作区</h1>
        <p>
          当前页面不会使用 mock 或 fallback 伪造成业务成功。启动后端并刷新后，页面会重新读取接口字段、按钮守卫和图表 DTO。
        </p>
      </div>
      <dl>
        <div>
          <dt>API Base</dt>
          <dd>{apiBaseUrl}</dd>
        </div>
        <div>
          <dt>错误</dt>
          <dd>{error?.errorMessage ?? "尚未完成后端同步"}</dd>
        </div>
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
    </section>
  );
}

