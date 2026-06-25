import type { ApiError } from "../domain/api";
import { userFacingText } from "./displayText";

interface BackendUnavailableStateProps {
  apiBaseUrl: string;
  error?: ApiError;
  modeLabel?: string;
}

export function BackendUnavailableState({
  apiBaseUrl,
  error,
  modeLabel = "系统未连接",
}: BackendUnavailableStateProps) {
  return (
    <section className="backendUnavailable compact" aria-live="polite">
      <div className="backendUnavailableSummary">
        <span className="stateEyebrow">{userFacingText(modeLabel)}</span>
        <h2>系统未连接或连接配置错误</h2>
        <p>
          当前页面保留操作骨架，但不会伪造成业务成功。系统连接后会重新读取业务字段、按钮守卫和图表数据。
        </p>
      </div>
      <div className="backendUnavailableInline">
        <span>{userFacingText(error?.errorMessage ?? "正在连接系统")}</span>
      </div>
      <details className="backendUnavailableDetails">
        <summary>连接诊断</summary>
        <dl>
          <div>
            <dt>连接地址</dt>
            <dd>{apiBaseUrl}</dd>
          </div>
          <div>
            <dt>建议</dt>
            <dd>{userFacingText(error?.repairSuggestion ?? "确认服务已启动，并检查连接地址。")}</dd>
          </div>
          {error?.detail ? (
            <div>
            <dt>详情</dt>
            <dd>{userFacingText(error.detail)}</dd>
            </div>
          ) : null}
        </dl>
      </details>
    </section>
  );
}
