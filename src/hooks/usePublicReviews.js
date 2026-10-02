import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * GET /public/reviews, once per page load: the hero's rating line and the
 * "What students say" section read the same answer from one request. A
 * failed request resolves to null (the line and the section simply do not
 * render) and is forgotten, so the next page view asks again.
 */
let request = null;

export function fetchPublicReviews() {
  if (!request) {
    request = (typeof base44?.functions?.get === 'function'
      ? base44.functions.get('/public/reviews').then((res) => res?.data || null)
      : Promise.resolve(null)
    ).catch(() => {
      request = null;
      return null;
    });
  }
  return request;
}

export function usePublicReviews() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchPublicReviews().then((value) => { if (!cancelled) setStats(value); });
    return () => { cancelled = true; };
  }, []);
  return stats;
}
