export function jsonResponse(
  body: unknown,
  { status = 200, etag }: { status?: number; etag?: string } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(etag ? { ETag: etag } : {}),
    },
  });
}
