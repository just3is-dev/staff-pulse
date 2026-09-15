import { createHash } from 'node:crypto';

export function computeEtag(body: string): string {
  return `"${createHash('sha1').update(body).digest('base64url')}"`;
}

const opaqueTag = (tag: string) => tag.trim().replace(/^W\//, '');

export function ifNoneMatchIncludes(
  header: string | undefined,
  etag: string,
): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;
  return header.split(',').some((tag) => opaqueTag(tag) === opaqueTag(etag));
}
