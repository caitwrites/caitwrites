import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Footer } from '../src/components/Footer';
import { Header } from '../src/components/Header';
import { siteConfig } from '../src/config/site';
import { HomePage } from '../src/pages/HomePage';
import { ContactPage } from '../src/pages/ContactPage';
import { GalleryPage } from '../src/pages/GalleryPage';
import { sortFilterOptions, staticPortfolioRecords } from '../src/lib/portfolio';

const expectedNavigation = ['Home', 'Web Copy', 'Blogs', 'Social Media', 'About', 'Get in Touch'];

describe('navigation refinements', () => {
  it('uses the requested desktop order and a direct Web Copy link', () => {
    render(<MemoryRouter><Header /></MemoryRouter>);
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    const links = within(navigation).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(expectedNavigation);
    expect(within(navigation).getByRole('link', { name: 'Web Copy' })).toHaveAttribute('href', '/web-copy');
    expect(within(navigation).queryByText('Short-form')).not.toBeInTheDocument();
  });

  it('uses the same order in mobile navigation and the footer', () => {
    render(<MemoryRouter><Header /><Footer /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const mobile = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(within(mobile).getAllByRole('link').map((link) => link.textContent)).toEqual(expectedNavigation);
    const footer = screen.getByRole('navigation', { name: 'Footer navigation' });
    expect(within(footer).getAllByRole('link').slice(0, 6).map((link) => link.textContent)).toEqual(expectedNavigation);
  });
});

describe('LinkedIn contact experience', () => {
  it('uses the centrally configured LinkedIn URL and no email action', () => {
    const { container } = render(<MemoryRouter><ContactPage /></MemoryRouter>);
    const link = screen.getByRole('link', { name: /connect on linkedin/i });
    expect(link).toHaveAttribute('href', siteConfig.linkedIn);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
  });
});

describe('homepage refinements', () => {
  it('shows one LinkedIn hero CTA, six ordered skills, View More and eight featured items', async () => {
    const { container } = render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText(siteConfig.eyebrow)).toBeInTheDocument();
    const heroCta = screen.getByRole('link', { name: /connect on linkedin/i });
    expect(heroCta).toHaveAttribute('href', siteConfig.linkedIn);
    expect(heroCta).toHaveAttribute('target', '_blank');
    expect(heroCta).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText(/explore my work/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/view my linkedin/i)).not.toBeInTheDocument();
    const portrait = screen.getByRole('img', { name: 'Cait smiling outdoors in a garden.' });
    expect(portrait).toHaveAttribute('src', '/images/cait-hero-desktop.webp');
    expect(portrait).toHaveAttribute('width', '1402');
    expect(portrait).toHaveAttribute('height', '1122');
    const mobilePortrait = container.querySelector('picture source[media="(max-width: 767px)"]');
    expect(mobilePortrait).toHaveAttribute('srcset', '/images/cait-hero-mobile.webp');
    expect(screen.queryByText(/skills & expertise/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Highlights.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view more/i })).toHaveAttribute('href', '/web-copy');
    expect(container.querySelectorAll('article.portfolio-card')).toHaveLength(8);
    const expectedNewestFavourites = staticPortfolioRecords.filter((record) => record.favourite).sort((a, b) => b.displayOrder - a.displayOrder).slice(0, 8).map((record) => record.title.trim());
    await waitFor(() => expect([...container.querySelectorAll('article.portfolio-card h3')].map((element) => element.textContent?.trim())).toEqual(expectedNewestFavourites));
    expect([...container.querySelectorAll('.skills-list span')].map((element) => element.textContent)).toEqual([
      'Web Copy', 'Blog Writing', 'SEO-Friendly Copy', 'Email Copy', 'Social Media', 'Content Strategy',
    ]);
  });
});

describe('gallery refinements', () => {
  it.each([
    ['blog', '/blogs?company=not-a-company'],
    ['web-copy', '/web-copy?company=not-a-company'],
    ['social-media', '/social-media?company=not-a-company'],
  ] as const)('shows the custom empty state for zero %s results', async (category, route) => {
    const { container } = render(<MemoryRouter initialEntries={[route]}><GalleryPage category={category} /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Currently brainstorming, click through again later' })).toBeInTheDocument();
    expect(container.querySelector('.thought-bubble-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(container.querySelector('.pagination')).not.toBeInTheDocument();
    expect(container.querySelector('.results-count')).not.toBeInTheDocument();
  });

  it('removes the redundant gallery heading while preserving counts and filter recovery', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/web-copy?company=not-a-company']}><GalleryPage category="web-copy" /></MemoryRouter>);
    expect(await screen.findByText('Currently brainstorming, click through again later')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /selected web copy/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(container.querySelectorAll('article.portfolio-card').length).toBeGreaterThan(0));
    expect(screen.getByText(/\d+ results?/i)).toBeInTheDocument();
    expect(screen.queryByText('Currently brainstorming, click through again later')).not.toBeInTheDocument();
  });
});

describe('filter option ordering', () => {
  it('pins the All option first and alphabetises user-facing labels', () => {
    const result = sortFilterOptions([
      { label: 'Travel Chasers', value: 'travel-chasers' },
      { label: 'All Companies', value: '' },
      { label: 'Rhino Africa', value: 'rhino-africa' },
      { label: 'Lawsons & Daughters', value: 'lawsons-and-daughters' },
    ]);
    expect(result.map((option) => option.label)).toEqual(['All Companies', 'Lawsons & Daughters', 'Rhino Africa', 'Travel Chasers']);
  });
});
