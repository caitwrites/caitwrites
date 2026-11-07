import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { GalleryPage } from './pages/GalleryPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([{ path: '/', element: <Layout />, children: [
  { index: true, element: <HomePage /> },
  { path: 'blogs', element: <GalleryPage category="blog" /> },
  { path: 'web-copy', element: <GalleryPage category="web-copy" /> },
  { path: 'social-media', element: <GalleryPage category="social-media" /> },
  { path: 'about', element: <AboutPage /> },
  { path: 'contact', element: <ContactPage /> },
  { path: '*', element: <NotFoundPage /> },
]}]);

export function App() { return <RouterProvider router={router} />; }
