const { kv } = require('@vercel/kv');

const PREFIX = 'qr:';

function qrKey(slug) {
  return `${PREFIX}${slug}`;
}

const LIST_KEY = 'qr:list';

async function createQr(slug, destination, key) {
  const existing = await kv.get(qrKey(slug));
  if (existing) {
    const err = new Error('Slug already exists.');
    err.status = 409;
    throw err;
  }

  const entry = {
    slug,
    destination,
    key,
    scans: 0,
    createdAt: Date.now(),
  };

  await kv.set(qrKey(slug), JSON.stringify(entry));
  await kv.sadd(LIST_KEY, slug);
  return entry;
}

async function getQr(slug) {
  const raw = await kv.get(qrKey(slug));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function updateQr(slug, destination, key) {
  const entry = await getQr(slug);
  if (!entry) {
    const err = new Error('QR code not found.');
    err.status = 404;
    throw err;
  }
  if (entry.key !== key) {
    const err = new Error('Invalid management key.');
    err.status = 403;
    throw err;
  }

  entry.destination = destination;
  await kv.set(qrKey(slug), JSON.stringify(entry));
  return entry;
}

async function deleteQr(slug, key) {
  const entry = await getQr(slug);
  if (!entry) {
    const err = new Error('QR code not found.');
    err.status = 404;
    throw err;
  }
  if (entry.key !== key) {
    const err = new Error('Invalid management key.');
    err.status = 403;
    throw err;
  }

  await kv.del(qrKey(slug));
  await kv.srem(LIST_KEY, slug);
}

async function recordScan(slug) {
  await kv.hincrby(qrKey(slug), 'scans', 1);
}

async function listQrs() {
  const slugs = await kv.smembers(LIST_KEY);
  if (!slugs || slugs.length === 0) return [];

  const entries = [];
  for (const slug of slugs) {
    const entry = await getQr(slug);
    if (entry) entries.push(entry);
  }
  entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return entries;
}

module.exports = { createQr, getQr, updateQr, deleteQr, recordScan, listQrs };
