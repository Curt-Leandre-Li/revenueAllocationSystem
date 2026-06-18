interface EmptyGuideProps {
  title: string;
  description: string;
}

export function EmptyGuide({ title, description }: EmptyGuideProps) {
  return (
    <div className="emptyGuide">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
