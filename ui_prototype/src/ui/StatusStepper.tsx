import { getStatusIndex, projectStatusFlow, projectStatusLabels } from "../domain/status";
import type { StatusCode } from "../domain/types";

interface StatusStepperProps {
  current: StatusCode;
}

export function StatusStepper({ current }: StatusStepperProps) {
  const currentIndex = getStatusIndex(current);

  return (
    <ol className="statusStepper" aria-label="项目状态">
      {projectStatusFlow.map((status, index) => {
        const stepState =
          index < currentIndex ? "done" : index === currentIndex ? "current" : "pending";
        return (
          <li className={`statusStep ${stepState}`} key={status}>
            <span>{index + 1}</span>
            <strong>{projectStatusLabels[status]}</strong>
          </li>
        );
      })}
    </ol>
  );
}
