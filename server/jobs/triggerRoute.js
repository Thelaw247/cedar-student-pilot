export async function triggerRoute(path, tokenName) {
  const origin = String(process.env.CEDAR_API_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env[tokenName] || '').trim();
  if (!origin || !/^https:\/\//.test(origin)) throw new Error('CEDAR_API_URL must be an HTTPS origin');
  if (!token) throw new Error(`${tokenName} is not configured`);

  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cedar-trigger-token': token },
    body: '{}',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `scheduled route returned ${response.status}`);
  return result;
}
