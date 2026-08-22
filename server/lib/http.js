const LOCAL_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function configuredOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([
    ...configured,
    ...(process.env.NODE_ENV === 'production' ? [] : LOCAL_ORIGINS),
  ]);
}

export function requestSecurity(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  });

  const origin = req.get('Origin');
  if (!origin) return next();

  const allowed = configuredOrigins();
  if (!allowed.has(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  res.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Stripe-Signature',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    Vary: 'Origin',
  });

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}
