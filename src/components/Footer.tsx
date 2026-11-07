import { Link } from 'react-router-dom';
import { siteConfig } from '../config/site';
import { primaryNavigation } from '../config/navigation';

export function Footer() {
  return (
    <footer className="mt-20 border-t border-ink/15 py-10 lg:mt-28">
      <div className="page-shell grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
        <div><div className="wordmark">caitwrites<span>.</span></div><p className="mt-3 max-w-md text-sm text-muted">Clear, considered copy for blogs, websites and social media.</p></div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold" aria-label="Footer navigation">
          {primaryNavigation.map((item) => <Link to={item.to} key={item.to}>{item.label}</Link>)}
          <a href={siteConfig.linkedIn} target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </nav>
        <p className="text-xs text-muted md:col-span-2">© {new Date().getFullYear()} Cait Writes. All rights reserved.</p>
      </div>
    </footer>
  );
}
