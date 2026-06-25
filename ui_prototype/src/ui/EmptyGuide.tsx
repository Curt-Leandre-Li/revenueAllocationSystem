import { userFacingText } from "./displayText";

interface EmptyGuideProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyGuide({ title, description, actionLabel, onAction }: EmptyGuideProps) {
  return (
    <div className="emptyGuide">
      <strong>{userFacingText(title)}</strong>
      <p>{userFacingText(description)}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {userFacingText(actionLabel)}
        </button>
      ) : null}
    </div>
  );
}
