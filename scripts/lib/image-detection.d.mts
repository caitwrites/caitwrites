export type ImageCandidateSource = 'open-graph' | 'twitter' | 'hero';
export interface ImageCandidate {
  url: string;
  source: ImageCandidateSource;
  score: number;
}
export function decodeHtml(value: unknown): string;
export function getMetaContent(html: string, name: string): string;
export function normalizeImageUrl(raw: unknown, baseUrl: string): string;
export function collectImageCandidates(html: string, baseUrl: string): ImageCandidate[];
export function chooseUsableImage(
  candidates: ImageCandidate[],
  validate: (candidate: ImageCandidate) => boolean | Promise<boolean>,
  limit?: number,
): Promise<ImageCandidate | null>;
