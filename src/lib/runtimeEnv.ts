const readPublicEnv = (name: keyof ImportMetaEnv): string => {
  const value = import.meta.env[name];
  return typeof value === 'string' ? value.trim() : '';
};

export const runtimeEnv = Object.freeze({
  supabaseUrl: readPublicEnv('VITE_SUPABASE_URL'),
  supabasePublishableKey: readPublicEnv('VITE_SUPABASE_PUBLISHABLE_KEY'),
  cloudinaryCloudName: readPublicEnv('VITE_CLOUDINARY_CLOUD_NAME'),
});

export const cloudReadiness = Object.freeze({
  supabase: Boolean(runtimeEnv.supabaseUrl && runtimeEnv.supabasePublishableKey),
  cloudinary: Boolean(runtimeEnv.cloudinaryCloudName),
});
