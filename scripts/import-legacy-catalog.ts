import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { INITIAL_MENU_ITEMS, INITIAL_RAW_MATERIALS } from '../src/data/initialData';

const TENANT_ID = '00000000-0000-4000-a000-000000000001';
const BRANCH_ID = '00000000-0000-4000-a000-000000000010';
const TARGET_APP_URL = process.env.TARGET_APP_URL || 'https://pos-pro-eight.vercel.app';
const SOURCE_PATH = process.env.SOURCE_CATALOG_PATH || `${process.env.TEMP || '.'}/omnipos-source-catalog.json`;
const ONLY_NAMES = (process.env.REPAIR_ONLY_NAMES || '').split('|').map((name) => name.trim()).filter(Boolean);

const CURRENT_STOCK: Record<string, number> = {
  'Bakso Daging': 17617, 'Bakso Isi Daging Sedang': 10589, 'BAKSO KEJU': 22851,
  'Bakso Polos Kecil': 9551, 'Bakso Urat': 14835, 'Bakso Urat Gimbal': 9369,
  'Bakso Urat Jumbo': 954, 'Mie Ayam': 7636, Beras: 5, Keju: 6, Minyak: 2,
  'Rumput Laut': 5, Skm: 3, 'Skm Coklat': 2, Sunlight: 4, 'Susu Skm': 5,
  Terigu: 2, 'Tiga Sapi': 4, Bihun: 45, gula: 29, KECAP: 29, Mie: 40,
  Mozza: 22, Mutiara: 125, 'Nata D Coco': 48, Nutrijel: 23, 'Sagu Tani': 23,
  Sasa: 16, 'Saus Cabe': 71, 'SAUS TOMAT': 66, Swallow: 12, 'Teh Bendera': 39,
  'Tepung Beras': 30,
};

interface SourceProduct { name: string; price: number; image: string; sortOrder: number }
interface SourceFile { products: SourceProduct[] }

function deterministicUuid(scope: string) {
  const bytes = Buffer.from(createHash('sha256').update(scope).digest('hex').slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function getMigrationAccessToken(admin: SupabaseClient<any>, supabaseUrl: string, publishableKey: string) {
  const { data: ownerMembership, error: membershipError } = await admin
    .from('branch_members').select('user_id').eq('branch_id', BRANCH_ID).eq('is_active', true).in('role', ['SUPER_OWNER', 'OWNER']).limit(1).single();
  if (membershipError || !ownerMembership) throw new Error('Akun owner aktif tidak ditemukan');
  const ownerUserId = (ownerMembership as { user_id: string }).user_id;
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(ownerUserId);
  if (userError || !userData.user.email) throw new Error('Email internal owner tidak ditemukan');
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: userData.user.email });
  if (linkError || !link.properties?.hashed_token) throw new Error('Sesi migrasi tidak dapat dibuat');
  const publicClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: verifyError } = await publicClient.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (verifyError || !verified.session?.access_token) throw new Error('Token migrasi tidak dapat diverifikasi');
  return verified.session.access_token;
}

async function getUploadSignature(accessToken: string) {
  const response = await fetch(`${TARGET_APP_URL}/api/cloudinary-sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ folder: 'menus', branchId: BRANCH_ID }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Signature Cloudinary gagal');
  return payload as { timestamp: number; signature: string; apiKey: string; cloudName: string; folder: string; uploadPreset: string; overwrite: string; uniqueFilename: string };
}

async function uploadDataImage(product: SourceProduct, signed: Awaited<ReturnType<typeof getUploadSignature>>) {
  if (!product.image.startsWith('data:')) return '';
  const match = product.image.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return '';
  const extension = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(match[2], 'base64')], { type: match[1] }), `${deterministicUuid(product.name)}.${extension}`);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  form.append('folder', signed.folder);
  form.append('upload_preset', signed.uploadPreset);
  form.append('overwrite', signed.overwrite);
  form.append('unique_filename', signed.uniqueFilename);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`, { method: 'POST', body: form });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `HTTP ${response.status}`);
  return String(payload.secure_url || '');
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>) {
  const output = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await fn(items[index], index);
    }
  }));
  return output;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !secretKey || !publishableKey) throw new Error('Environment Supabase belum lengkap');
  const source = JSON.parse(await readFile(SOURCE_PATH, 'utf8')) as SourceFile;
  if (source.products.length !== 53) throw new Error(`Katalog sumber tidak lengkap: ${source.products.length}/53`);
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const accessToken = await getMigrationAccessToken(admin, supabaseUrl, publishableKey);
  const signature = await getUploadSignature(accessToken);
  const productsToUpload = ONLY_NAMES.length
    ? source.products.filter((product) => ONLY_NAMES.includes(product.name))
    : source.products;
  if (ONLY_NAMES.length && productsToUpload.length !== ONLY_NAMES.length) {
    throw new Error(`Produk perbaikan tidak lengkap: ${productsToUpload.length}/${ONLY_NAMES.length}`);
  }
  const failedImages: Array<{ name: string; error: string }> = [];
  const uploadedSubset = await mapConcurrent(productsToUpload, 3, async (product) => {
    try {
      return await uploadDataImage(product, signature);
    } catch (error) {
      failedImages.push({ name: product.name, error: error instanceof Error ? error.message : 'Upload gagal' });
      return '';
    }
  });
  if (ONLY_NAMES.length) {
    const repaired: string[] = [];
    for (let index = 0; index < productsToUpload.length; index += 1) {
      const secureUrl = uploadedSubset[index];
      if (!secureUrl) continue;
      const product = productsToUpload[index];
      const menuId = deterministicUuid(`menu:${BRANCH_ID}:${product.name.toLocaleLowerCase('id-ID')}`);
      const { error } = await admin.from('menu_items').update({ image_url: secureUrl }).eq('id', menuId).eq('branch_id', BRANCH_ID);
      if (error) throw error;
      repaired.push(product.name);
    }
    console.log(JSON.stringify({ repaired, failedImages }));
    return;
  }
  const uploadedUrls = uploadedSubset;
  const templates = new Map(INITIAL_MENU_ITEMS.map((item) => [item.name.toLocaleLowerCase('id-ID'), item]));
  const menuRows = source.products.map((product, index) => {
    const template = templates.get(product.name.toLocaleLowerCase('id-ID'));
    const inferredCategory = /^bundle\s+\d+$/i.test(product.name) ? 'BUNDLING' : null;
    if (!template && !inferredCategory) throw new Error(`Kategori menu tidak ditemukan: ${product.name}`);
    return {
      id: deterministicUuid(`menu:${BRANCH_ID}:${product.name.toLocaleLowerCase('id-ID')}`), tenant_id: TENANT_ID, branch_id: BRANCH_ID,
      name: product.name, category: template?.category || inferredCategory, price: product.price, image_url: uploadedUrls[index] || null,
      description: template?.description || null, hpp_cost: template?.hppCost || 0, is_available: template?.isAvailable !== false,
      stock_count: template?.stockCount ?? null, sort_order: product.sortOrder,
    };
  });
  const sourceRaw = INITIAL_RAW_MATERIALS.filter((item) => item.branchId === BRANCH_ID && Object.hasOwn(CURRENT_STOCK, item.name));
  if (sourceRaw.length !== 33) throw new Error(`Inventory sumber tidak lengkap: ${sourceRaw.length}/33`);
  const rawRows = sourceRaw.map((item) => ({
    id: deterministicUuid(`raw:${BRANCH_ID}:${item.name.toLocaleLowerCase('id-ID')}`), tenant_id: TENANT_ID, branch_id: BRANCH_ID,
    name: item.name, unit: item.unit, stock_quantity: CURRENT_STOCK[item.name], min_stock_threshold: item.minStockThreshold, cost_per_unit: item.costPerUnit,
  }));

  const { error: menuError } = await admin.from('menu_items').upsert(menuRows, { onConflict: 'id' });
  if (menuError) throw menuError;
  const { error: rawError } = await admin.from('raw_materials').upsert(rawRows, { onConflict: 'id' });
  if (rawError) throw rawError;

  const [{ data: existingMenus }, { data: existingRaw }] = await Promise.all([
    admin.from('menu_items').select('id').eq('branch_id', BRANCH_ID),
    admin.from('raw_materials').select('id').eq('branch_id', BRANCH_ID),
  ]);
  const menuIds = new Set(menuRows.map((row) => row.id));
  const rawIds = new Set(rawRows.map((row) => row.id));
  const staleMenuIds = (existingMenus || []).map((row) => row.id).filter((id) => !menuIds.has(id));
  const staleRawIds = (existingRaw || []).map((row) => row.id).filter((id) => !rawIds.has(id));
  if (staleMenuIds.length) {
    const { error } = await admin.from('menu_items').delete().in('id', staleMenuIds);
    if (error) throw error;
  }
  if (staleRawIds.length) {
    const { error } = await admin.from('raw_materials').delete().in('id', staleRawIds);
    if (error) throw error;
  }
  console.log(JSON.stringify({ menuItems: menuRows.length, uploadedImages: uploadedUrls.filter(Boolean).length, failedImages, rawMaterials: rawRows.length, removedDummyMenus: staleMenuIds.length, removedDummyRawMaterials: staleRawIds.length }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
