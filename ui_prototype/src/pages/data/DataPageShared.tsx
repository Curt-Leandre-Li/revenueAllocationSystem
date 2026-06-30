import type { ReactNode } from "react";
import type { RoutePath } from "../../domain/types";
import { userFacingText } from "../../ui/displayText";

type Tone = "neutral" | "success" | "warning" | "danger";
type StepState = "done" | "current" | "pending" | "failed";

export interface DataMetricCard {
  label: string;
  value: string | number;
  hint: string;
  tone?: Tone;
  icon?: ReactNode;
  progress?: number;
}

export interface WorkflowStep {
  title: string;
  hint: string;
  state: StepState;
}

export interface NextStepItem {
  title: string;
  description: string;
  route: RoutePath;
  active?: boolean;
}

interface DataMetricStripProps {
  items: DataMetricCard[];
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
}

interface NextStepStripProps {
  title: string;
  description: string;
  steps: NextStepItem[];
  statusTitle: string;
  statusDescription: string;
  onNavigate: (route: RoutePath) => void;
}

interface BooleanBadgeProps {
  value: boolean;
}

interface StatusBadgeProps {
  value: string;
  tone?: Tone;
}

export function DataMetricStrip({ items }: DataMetricStripProps) {
  return (
    <section className="dataMetricStrip" aria-label="页面关键指标">
      {items.map((item) => (
        <article className={`dataMetricCard ${item.tone ?? "neutral"}`} key={item.label}>
          <div className="dataMetricIcon" aria-hidden="true">
            {item.icon ?? item.label.slice(0, 1)}
          </div>
          <div>
            <span>{userFacingText(item.label)}</span>
            <strong>{userFacingText(item.value)}</strong>
            {item.progress !== undefined ? (
              <div className="metricProgress" aria-label={`${item.label}${item.progress}%`}>
                <i style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
              </div>
            ) : null}
            <small>{userFacingText(item.hint)}</small>
          </div>
        </article>
      ))}
    </section>
  );
}

export function WorkflowStepper({ steps }: WorkflowStepperProps) {
  return (
    <ol className="dataWorkflowStepper" aria-label="导入流程">
      {steps.map((step, index) => (
        <li className={step.state} key={step.title}>
          <span>{step.state === "done" ? "✓" : index + 1}</span>
          <div>
            <strong>{userFacingText(step.title)}</strong>
            <small>{userFacingText(step.hint)}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function NextStepStrip({
  title,
  description,
  steps,
  statusTitle,
  statusDescription,
  onNavigate,
}: NextStepStripProps) {
  return (
    <section className="nextStepStrip">
      <div className="nextStepMain">
        <div className="nextStepHead">
          <h2>{userFacingText(title)}</h2>
          <p>{userFacingText(description)}</p>
        </div>
        <div className="nextStepItems">
          {steps.map((step, index) => (
            <button
              className={step.active ? "active" : ""}
              key={step.route}
              type="button"
              onClick={() => onNavigate(step.route)}
            >
              <span>{index + 1}</span>
              <strong>{userFacingText(step.title)}</strong>
              <small>{userFacingText(step.description)}</small>
            </button>
          ))}
        </div>
      </div>
      <aside className="nextStepStatus">
        <strong>{userFacingText(statusTitle)}</strong>
        <p>{userFacingText(statusDescription)}</p>
      </aside>
    </section>
  );
}

export function BooleanBadge({ value }: BooleanBadgeProps) {
  return <span className={`booleanBadge ${value ? "yes" : "no"}`}>{value ? "是" : "否"}</span>;
}

export function StatusBadge({ value, tone = "neutral" }: StatusBadgeProps) {
  return <span className={`statusBadge ${tone}`}>{userFacingText(value)}</span>;
}
