const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const PREFIX = 'qr:';

function qrKey(slug) {
  return `${PREFIX}${slug}`;
}

const LIST_KEY = 'qr:list';

async function createQr(slug, destination, key) {
  const existing = await redis.get(qrKey(slug));
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

  await redis.set(qrKey(slug), JSON.stringify(entry));
  await redis.sadd(LIST_KEY, slug);
  return entry;
}

async function getQr(slug) {
  const raw = await redis.get(qrKey(slug));
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
  await redis.set(qrKey(slug), JSON.stringify(entry));
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

  await redis.del(qrKey(slug));
  await redis.srem(LIST_KEY, slug);
}

async function recordScan(slug) {
  try {
    const key = qrKey(slug);
    const raw = await redis.get(key);
    if (raw) {
      const entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
      entry.scans = (entry.scans || 0) + 1;
      await redis.set(key, JSON.stringify(entry));
    }
  } catch {
    /* non-critical, skip on failure */
  }
}

async function listQrs() {
  const slugs = await redis.smembers(LIST_KEY);
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
