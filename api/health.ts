const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
  });

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') return json({error: 'Method not allowed'}, 405);

    const checks = {
      supabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      supabasePublicKey: Boolean(
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY,
      ),
      supabaseServerKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      cloudinaryCredentials: Boolean(
        process.env.CLOUDINARY_URL ||
        (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET && process.env.CLOUDINARY_CLOUD_NAME),
      ),
    };
    const ready = Object.values(checks).every(Boolean);
    return json({status: ready ? 'ready' : 'configuration_required', checks}, ready ? 200 : 503);
  },
};
