interface EmptyGuideProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyGuide({ title, description, actionLabel, onAction }: EmptyGuideProps) {
  return (
    <div className="emptyGuide">
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
