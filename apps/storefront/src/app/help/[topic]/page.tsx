import type { Metadata } from "next";
import { notFound } from "next/navigation";
import supportContent from "@farta/staging-knowledge";

type PageProps = { params: Promise<{ topic: string }> };

function stagingContentEnabled(): boolean {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return (
    process.env.NODE_ENV !== "production" ||
    site === "https://staging.fartacommerce.me"
  );
}

function contentFor(topic: string) {
  return supportContent.find(
    (entry) => entry.canonicalPath === `/help/${topic}`,
  );
}

export function generateStaticParams() {
  return supportContent.map((entry) => ({
    topic: entry.canonicalPath.split("/").at(-1) ?? "",
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const entry = contentFor((await params).topic);
  if (!entry || !stagingContentEnabled()) return { robots: { index: false } };
  return {
    title: entry.title,
    description: entry.sections[0],
    alternates: { canonical: entry.canonicalPath },
    robots: { index: false, follow: false },
  };
}

export default async function HelpTopicPage({ params }: PageProps) {
  const entry = contentFor((await params).topic);
  if (!entry || !stagingContentEnabled()) notFound();

  return (
    <main id="main-content" className="catalog-page">
      <header className="catalog-hero">
        <p>FARTA / Staging</p>
        <h1>{entry.title}</h1>
        <div>
          Thông tin thử nghiệm được FARTA duyệt cho staging. Các điều khoản chưa
          công bố được nêu rõ bên dưới.
        </div>
      </header>
      <section className="help-content" aria-label={entry.title}>
        {entry.sections.map((section) => (
          <p key={section}>{section}</p>
        ))}
      </section>
    </main>
  );
}
