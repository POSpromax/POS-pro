const QR_TOKEN_VERSION = 1;
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getSecret(): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.QR_TOKEN_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-fallback-secret';
  }
  return 'dev-fallback-secret';
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacVerify(message: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(message, secret);
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return result === 0;
}

export interface QrTokenPayload {
  branchId: string;
  tableNumber: string;
  expiresAt: number;
  version: number;
}

export async function generateQrToken(branchId: string, tableNumber: string, secret?: string): Promise<string> {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload: QrTokenPayload = { branchId, tableNumber, expiresAt, version: QR_TOKEN_VERSION };
  const payloadB64 = btoa(JSON.stringify(payload));
  const sig = await hmacSign(payloadB64, secret || getSecret());
  return `${payloadB64}.${sig}`;
}

export async function verifyQrToken(token: string, secret?: string): Promise<{ valid: true; payload: QrTokenPayload } | { valid: false; error: string }> {
  const dotIdx = token.indexOf('.');
  if (dotIdx < 1) return { valid: false, error: 'Format token tidak valid' };
  const payloadB64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const resolvedSecret = secret || getSecret();
  const isValid = await hmacVerify(payloadB64, sig, resolvedSecret);
  if (!isValid) return { valid: false, error: 'Token tidak sah' };
  try {
    const payload: QrTokenPayload = JSON.parse(atob(payloadB64));
    if (payload.version !== QR_TOKEN_VERSION) return { valid: false, error: 'Versi token tidak didukung' };
    if (Date.now() > payload.expiresAt) return { valid: false, error: 'Token sudah kedaluwarsa' };
    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Payload token rusak' };
  }
}

export function buildSelfOrderUrl(baseUrl: string, branchId: string, tableNumber: string, token: string): string {
  const url = new URL('/', baseUrl);
  url.searchParams.set('selforder', 'true');
  url.searchParams.set('branch', branchId);
  url.searchParams.set('table', tableNumber);
  url.searchParams.set('token', token);
  return url.toString();
}
