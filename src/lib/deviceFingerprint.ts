let cachedHash: string | null = null;

export async function getDeviceFingerprintHash(): Promise<string> {
  if (cachedHash) return cachedHash;

  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || 0,
    navigator.maxTouchPoints || 0,
  ].join('|');

  const encoded = new TextEncoder().encode(raw);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(buffer);
  cachedHash = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return cachedHash;
}
