import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { siteConfig } from '../config/site';

const metadata: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Cait Writes | Copywriter & Content Creator',
    description: 'Cait Writes creates clear, compelling web copy, blogs and social content that connects, informs and inspires.',
  },
  '/web-copy': {
    title: 'Web Copy | Cait Writes',
    description: 'Explore Cait’s web copy portfolio, including short-form, long-form and informational website content.',
  },
  '/blogs': {
    title: 'Blogs | Cait Writes',
    description: 'Explore thoughtful, useful blog writing created to hold attention and leave readers with something worth remembering.',
  },
  '/social-media': {
    title: 'Social Media | Cait Writes',
    description: 'Explore platform-aware social media copy designed to catch the eye, sound human and keep conversations moving.',
  },
  '/about': {
    title: 'About | Cait Writes',
    description: 'Learn more about Cait’s copywriting approach, experience and commitment to clear, useful, human content.',
  },
  '/contact': {
    title: 'Contact | Cait Writes',
    description: 'Connect with Cait on LinkedIn to discuss web copy, blog writing, social media content and content strategy.',
  },
};

function setMeta(selector: string, attribute: string, value: string) {
  document.querySelector<HTMLMetaElement>(selector)?.setAttribute(attribute, value);
}

export function PageMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = metadata[pathname] || { title: 'Page not found | Cait Writes', description: 'The requested Cait Writes page could not be found.' };
    const canonical = `${siteConfig.canonicalUrl}${pathname === '/' ? '/' : pathname}`;
    document.title = page.title;
    setMeta('meta[name="description"]', 'content', page.description);
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', canonical);
    setMeta('meta[property="og:title"]', 'content', page.title);
    setMeta('meta[property="og:description"]', 'content', page.description);
    setMeta('meta[property="og:url"]', 'content', canonical);
    setMeta('meta[name="twitter:title"]', 'content', page.title);
    setMeta('meta[name="twitter:description"]', 'content', page.description);
  }, [pathname]);
  return null;
}
