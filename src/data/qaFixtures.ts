import type { Category, PortfolioRecord } from '../../shared/types';
import { seedRecords } from './seed';

const companies = ['Travel Chasers', 'Rhino Africa', 'Lawsons & Daughters'];
const webTypes = ['short-form', 'long-form', 'informational'];
const platforms = ['Instagram', 'Facebook', 'LinkedIn'];

function templateFor(category: Category): PortfolioRecord {
  return seedRecords.find((record) => record.category === category)!;
}

function makeFixtures(category: Category, count: number): PortfolioRecord[] {
  const template = templateFor(category);
  return Array.from({ length: count }, (_, index) => ({
    ...template,
    id: `qa-${category}-${index + 1}`,
    company: companies[index % companies.length],
    contentType: category === 'web-copy' ? webTypes[index % webTypes.length] : template.contentType,
    platform: category === 'social-media' ? platforms[index % platforms.length] : template.platform,
    favourite: false,
    title: `[QA only] ${category === 'blog' ? 'Blog' : category === 'web-copy' ? 'Web copy' : 'Social post'} card ${String(index + 1).padStart(2, '0')}`,
    description: 'Development-only pagination fixture based on a supplied real portfolio URL. Not a published record.',
    displayOrder: 100 + index,
  }));
}

export const qaFixtureRecords: PortfolioRecord[] = [
  ...makeFixtures('blog', 14),
  ...makeFixtures('web-copy', 14),
  ...makeFixtures('social-media', 14),
];
