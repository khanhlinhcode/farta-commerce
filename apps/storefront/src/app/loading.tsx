export default function Loading() {
  return (
    <main id="main-content" className="page-loading" aria-busy="true">
      <span className="skeleton-line skeleton-line--short" />
      <span className="skeleton-line skeleton-line--title" />
      <div className="skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="skeleton-card" key={index} />
        ))}
      </div>
      <span className="sr-only">Đang tải FARTA…</span>
    </main>
  );
}
