import {getSupabase} from '../lib/supabase';
import {runtimeEnv} from '../lib/runtimeEnv';

export type MediaFolder = 'branding' | 'menus' | 'avatars' | 'attendance';

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
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadImage(file: File, folder: MediaFolder): Promise<UploadedMedia> {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Ukuran gambar maksimal 5 MB.');
  if (!runtimeEnv.cloudinaryCloudName) throw new Error('Cloudinary belum dikonfigurasi.');

  const supabase = getSupabase();
  const {data: {session}} = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sesi telah berakhir. Silakan masuk kembali.');

  const signatureResponse = await fetch('/api/cloudinary-sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({folder}),
  });

  if (!signatureResponse.ok) throw new Error('Gagal memperoleh izin upload media.');
  const signed = await signatureResponse.json() as UploadSignature;

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', signed.apiKey);
  body.append('timestamp', String(signed.timestamp));
  body.append('signature', signed.signature);
  body.append('folder', signed.folder);
  body.append('upload_preset', signed.uploadPreset);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`,
    {method: 'POST', body},
  );

  if (!uploadResponse.ok) throw new Error('Upload media gagal.');
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
