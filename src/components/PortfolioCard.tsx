import { ExternalLink } from 'lucide-react';
import type { PortfolioRecord } from '../../shared/types';
import { categoryLabel, titleForRecord } from '../lib/portfolio';
import { fallbackImage } from '../data/seed';
import { useState } from 'react';

export function PortfolioCard({ record }: { record: PortfolioRecord }) {
  const [image, setImage] = useState(record.imageUrl || fallbackImage[record.category]);
  return (
    <article className="portfolio-card">
      <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${titleForRecord(record)} — opens original work in a new tab`}>
        <div className="card-image-wrap">
          <img src={image} onError={() => setImage(fallbackImage[record.category])} alt={`${categoryLabel(record.category, record.contentType)} portfolio cover`} loading="lazy" decoding="async" />
          <span className="category-pill">{categoryLabel(record.category, record.contentType)}</span>
          <span className="external-icon"><ExternalLink className="size-4" aria-hidden="true" /></span>
        </div>
        <h3>{titleForRecord(record)}</h3>
        <p className="line-clamp-2" title={record.description}>{record.description}</p>
        {record.company && <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-purple">{record.company}</div>}
      </a>
    </article>
  );
}
