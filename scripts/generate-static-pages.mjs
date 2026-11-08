import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectRoot } from './lib/portfolio-data.mjs';

const siteUrl = 'https://caitwrites.co.za';
const distPath = path.join(projectRoot, 'dist');
const template = await readFile(path.join(distPath, 'index.html'), 'utf8');

const pages = [
  { path: '/', title: 'Cait Writes | Copywriter & Content Creator', description: 'Cait Writes creates clear, compelling web copy, blogs and social content that connects, informs and inspires.' },
  { path: '/web-copy', title: 'Web Copy | Cait Writes', description: 'Explore Cait’s web copy portfolio, including short-form, long-form and informational website content.' },
  { path: '/blogs', title: 'Blogs | Cait Writes', description: 'Explore thoughtful, useful blog writing created to hold attention and leave readers with something worth remembering.' },
  { path: '/social-media', title: 'Social Media | Cait Writes', description: 'Explore platform-aware social media copy designed to catch the eye, sound human and keep conversations moving.' },
  { path: '/about', title: 'About | Cait Writes', description: 'Learn more about Cait’s copywriting approach, experience and commitment to clear, useful, human content.' },
  { path: '/contact', title: 'Contact | Cait Writes', description: 'Connect with Cait on LinkedIn to discuss web copy, blog writing, social media content and content strategy.' },
];

function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderPage(page) {
  const canonical = `${siteUrl}${page.path === '/' ? '/' : page.path}`;
  const title = escapeAttribute(page.title);
  const description = escapeAttribute(page.description);
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${description}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${description}" />`);
}

for (const page of pages) {
  const directory = page.path === '/' ? distPath : path.join(distPath, page.path.slice(1));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), renderPage(page), 'utf8');
}

await writeFile(path.join(distPath, '404.html'), renderPage(pages[0]), 'utf8');
await writeFile(path.join(distPath, '.nojekyll'), '', 'utf8');
const dataset = JSON.parse(await readFile(path.join(projectRoot, 'public', 'data', 'portfolio.json'), 'utf8'));
const portfolioImages = [...new Set(dataset.records.map((record) => record.imageUrl).filter((imageUrl) => imageUrl.startsWith('/images/portfolio/')))];
for (const imageUrl of portfolioImages) await readFile(path.join(distPath, imageUrl.replace(/^\/+/, '')));
console.log(JSON.stringify({ staticRoutes: pages.map((page) => page.path), fallback: '/404.html', portfolioImages: portfolioImages.length }));
