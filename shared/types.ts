export type Category = 'blog' | 'web-copy' | 'social-media';
export type WebCopyType = 'short-form' | 'long-form' | 'informational';
export type MetadataStatus = 'pending' | 'success' | 'failed' | 'blocked';

export interface PortfolioRecord {
  id: string;
  sourceUrl: string;
  canonicalUrl: string;
  company: string;
  category: Category;
  contentType: string;
  platform: string;
  favourite: boolean;
  overview: string;
  title: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
}

export interface PortfolioQuery {
  category: Category;
  company?: string;
  type?: string;
  platform?: string;
  page: number;
  pageSize: number;
  favourites?: boolean;
}

export interface PaginatedResult {
  records: PortfolioRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
