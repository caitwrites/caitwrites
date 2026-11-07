import { siteConfig } from '../config/site';

export function PageIntro({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="page-shell page-intro"><p className="eyebrow">{siteConfig.eyebrow}</p><h1>{title}</h1><p className="max-w-2xl text-lg leading-relaxed text-muted">{children}</p></section>;
}
