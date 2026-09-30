import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

export function middleware(request: NextRequest, event: NextFetchEvent) {
  // A private fork must not phone an upstream author's internal analytics host.
  // Tracking is opt-in and is unrelated to CR3@TIX MAP / ANALYTIX.
  const collector = process.env.UMAMI_URL;
  const website = process.env.UMAMI_WEBSITE_ID;
  if (!collector || !website) return NextResponse.next();
  let endpoint: URL;
  try {
    endpoint = new URL('/api/send', collector);
    if (!['http:', 'https:'].includes(endpoint.protocol)) return NextResponse.next();
  } catch { return NextResponse.next(); }
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
  const userAgent = request.headers.get('user-agent') || 'Oeil-de-Dieu';
  const basePayload = {
    hostname: request.nextUrl.hostname,
    language: request.headers.get('accept-language')?.split(',')[0] || 'fr-FR',
    referrer: request.headers.get('referer') || '',
    title: 'ŒIL DE DIEU',
    url: request.nextUrl.pathname,
    website,
  };

  /* Bounded, because these are fire-and-forget analytics on the critical path.
     `umami-umami-1` only resolves inside the production compose network; on a
     developer's machine it is ENOTFOUND, and two unbounded requests per page
     view accumulated against the shared connection pool until the app's own
     API routes could not get a socket. The CCTV route would then time out
     region after region and the map came up half empty — the analytics were
     starving the thing they were measuring. */
  const pageView = fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'x-forwarded-for': ip },
    body: JSON.stringify({ payload: basePayload, type: "event" }),
    signal: AbortSignal.timeout(2000),
  }).catch(() => {});

  event.waitUntil(pageView);

  return NextResponse.next();
}

/* Assets are excluded, not just pages. MapLibre 6 loads its worker from
   /vendor/maplibre/<version>/ at runtime, and the basemap style from
   /dark-matter-style.json — neither is under _next/static, so both used to
   match here and pay two umami round trips before the map could start. That is
   the same starvation that 2f375dd fixed for the CCTV routes, moved onto the
   map's critical path. Analytics wants page views; asset fetches are not one. */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|vendor|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs|js|css|json|pbf|mvt|woff|woff2|ico|txt)$).*)',
  ],
}
