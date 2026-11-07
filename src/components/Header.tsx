import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { primaryNavigation } from '../config/navigation';

const navClass = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'nav-link-active' : ''}`;

export function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname, location.search]);

  return (
    <header className="site-header">
      <div className="page-shell flex h-20 items-center justify-between gap-8 lg:h-24">
        <Link to="/" className="wordmark" aria-label="Cait Writes home">caitwrites<span>.</span></Link>
        <button className="menu-button lg:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <X /> : <Menu />}
        </button>
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary navigation">
          {primaryNavigation.map((item) => 'cta' in item && item.cta
            ? <Link to={item.to} className="button button-small" key={item.to}>{item.label}</Link>
            : <NavLink to={item.to} end={'end' in item ? item.end : undefined} className={navClass} key={item.to}>{item.label}</NavLink>)}
        </nav>
      </div>
      {open && (
        <nav id="mobile-nav" className="mobile-nav lg:hidden" aria-label="Mobile navigation">
          {primaryNavigation.map((item) => 'cta' in item && item.cta
            ? <NavLink to={item.to} className="button button-small mt-1" key={item.to}>{item.label}</NavLink>
            : <NavLink to={item.to} end={'end' in item ? item.end : undefined} className={({ isActive }) => `mobile-nav-link ${isActive ? 'mobile-nav-link-active' : ''}`} key={item.to}>{item.label}</NavLink>)}
        </nav>
      )}
    </header>
  );
}
