export function optimizeCloudinaryImage(url: string, width: number): string {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  const marker = '/image/upload/';
  const safeWidth = Math.max(64, Math.min(1600, Math.round(width)));
  return url.replace(marker, `${marker}f_auto,q_auto:eco,c_limit,w_${safeWidth},dpr_auto/`);
}
