import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Footer } from './Footer';
import { Header } from './Header';
import { PageMetadata } from './PageMetadata';

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return <><PageMetadata /><a className="skip-link" href="#main">Skip to content</a><Header /><main id="main"><Outlet /></main><Footer /></>;
}
