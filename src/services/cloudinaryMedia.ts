import {getSupabase} from '../lib/supabase';

export type MediaFolder = 'branding' | 'menus' | 'avatars' | 'attendance' | 'leave';

export interface UploadedMedia {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

interface UploadSignature {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadPreset: string;
  overwrite: string;
  uniqueFilename: string;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadImage(file: File, folder: MediaFolder, branchId: string): Promise<UploadedMedia> {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Ukuran gambar maksimal 5 MB.');
  const supabase = getSupabase();
  const {data: {session}} = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sesi telah berakhir. Silakan masuk kembali.');

  const signatureResponse = await fetch('/api/cloudinary-sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({folder, branchId}),
  });

  if (!signatureResponse.ok) {
    // Tampilkan sebab asli dari server (mis. "Konfigurasi Cloudinary tidak valid",
    // "Role tidak diizinkan…", "Unauthorized") agar mudah didiagnosis, bukan pesan
    // generik yang menyembunyikan masalah sebenarnya.
    const detail = await signatureResponse.json().catch(() => ({} as { error?: string }));
    throw new Error(detail?.error ? `Gagal upload foto: ${detail.error}` : 'Gagal memperoleh izin upload media.');
  }
  const signed = await signatureResponse.json() as UploadSignature;

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', signed.apiKey);
  body.append('timestamp', String(signed.timestamp));
  body.append('signature', signed.signature);
  body.append('folder', signed.folder);
  body.append('upload_preset', signed.uploadPreset);
  body.append('overwrite', signed.overwrite);
  body.append('unique_filename', signed.uniqueFilename);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`,
    {method: 'POST', body},
  );

  if (!uploadResponse.ok) {
    const detail = await uploadResponse.json().catch(() => ({} as { error?: { message?: string } }));
    throw new Error(detail?.error?.message ? `Upload media gagal: ${detail.error.message}` : 'Upload media gagal.');
  }
  const result = await uploadResponse.json();
  return {
    publicId: result.public_id,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    format: result.format,
  };
}
