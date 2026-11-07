import { Link } from 'react-router-dom';
export function NotFoundPage() { return <section className="page-shell page-intro min-h-[50vh]"><p className="eyebrow">404</p><h1>That page needs a rewrite.</h1><p className="mb-8 text-lg text-muted">The page you were looking for doesn’t exist or has moved.</p><Link className="button" to="/">Back home</Link></section>; }
