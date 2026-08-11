import { handleCloudinarySign } from '../src/server/cloudinarySign';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const payload = (await request.json().catch(() => ({}))) as { folder?: string; branchId?: string };
  const result = await handleCloudinarySign(
    request.method,
    request.headers.get('Authorization') || '',
    payload,
  );
  return new Response(JSON.stringify(result.data), {
    status: result.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
