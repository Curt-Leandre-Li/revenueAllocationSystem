import { useId, useState, type FocusEvent, type MouseEvent } from "react";
import { userFacingText } from "./displayText";

interface PageTitleHintProps {
  title: string;
  description?: string;
}

interface TooltipPosition {
  x: number;
  y: number;
}

function clampTooltipPosition(x: number, y: number): TooltipPosition {
  const viewportWidth = Math.max(320, window.innerWidth);
  const viewportHeight = Math.max(160, window.innerHeight);
  const tooltipWidth = Math.min(520, viewportWidth - 32);
  const maxX = Math.max(16, viewportWidth - tooltipWidth - 16);
  const maxY = Math.max(28, viewportHeight - 28);

  return {
    x: Math.min(Math.max(16, x), maxX),
    y: Math.min(Math.max(28, y), maxY),
  };
}

export function PageTitleHint({ title, description }: PageTitleHintProps) {
  const tooltipId = useId();
  const titleText = userFacingText(title);
  const descriptionText = description ? userFacingText(description) : "";
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ x: 16, y: 28 });

  function showAtPointer(event: MouseEvent<HTMLHeadingElement>) {
    setPosition(clampTooltipPosition(event.clientX + 18, event.clientY));
    setVisible(Boolean(descriptionText));
  }

  function showAtTitle(event: FocusEvent<HTMLHeadingElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition(clampTooltipPosition(rect.right + 16, rect.top + rect.height / 2));
    setVisible(Boolean(descriptionText));
  }

  return (
    <div className="pageTitleHint">
      <h1
        aria-describedby={descriptionText ? tooltipId : undefined}
        tabIndex={descriptionText ? 0 : undefined}
        onBlur={() => setVisible(false)}
        onFocus={showAtTitle}
        onMouseEnter={showAtPointer}
        onMouseLeave={() => setVisible(false)}
        onMouseMove={showAtPointer}
      >
        {titleText}
      </h1>
      {descriptionText ? (
        <span
          aria-hidden={!visible}
          className={`pageTitleTooltip${visible ? " visible" : ""}`}
          id={tooltipId}
          role="tooltip"
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
          {descriptionText}
        </span>
      ) : null}
    </div>
  );
}
