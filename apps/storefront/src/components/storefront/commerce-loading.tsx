export function CommerceLoading({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="commerce-loading" role="status">
      <div className="commerce-loading__copy">
        <span>{label}</span>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      <div className="commerce-loading__skeleton" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
