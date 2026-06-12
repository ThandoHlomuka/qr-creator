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

/* ─── Profile ─── */
async function createProfile(id, name) {
  const profile = { id, name: name || 'My Profile', createdAt: Date.now(), qrCount: 0 };
  await redis.set(`profile:${id}`, JSON.stringify(profile));
  return profile;
}

async function getProfile(id) {
  const raw = await redis.get(`profile:${id}`);
  return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
}

async function updateProfile(id, updates) {
  const profile = await getProfile(id);
  if (!profile) return null;
  Object.assign(profile, updates);
  await redis.set(`profile:${id}`, JSON.stringify(profile));
  return profile;
}

async function saveQrToProfile(profileId, slug, settings) {
  const key = qrKey(slug);
  const raw = await redis.get(key);
  if (raw) {
    const entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
    entry.profileId = profileId;
    entry.settings = settings || entry.settings || {};
    await redis.set(key, JSON.stringify(entry));
  }
  await redis.sadd(`profile:${profileId}:qrs`, slug);
  const count = await redis.scard(`profile:${profileId}:qrs`);
  await updateProfile(profileId, { qrCount: count });
}

async function removeQrFromProfile(profileId, slug) {
  const key = qrKey(slug);
  const raw = await redis.get(key);
  if (raw) {
    const entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (entry.profileId === profileId) delete entry.profileId;
    await redis.set(key, JSON.stringify(entry));
  }
  await redis.srem(`profile:${profileId}:qrs`, slug);
  const count = await redis.scard(`profile:${profileId}:qrs`);
  await updateProfile(profileId, { qrCount: count });
}

async function getProfileQrs(profileId) {
  const slugs = await redis.smembers(`profile:${profileId}:qrs`);
  if (!slugs || slugs.length === 0) return [];
  const entries = [];
  for (const slug of slugs) {
    const entry = await getQr(slug);
    if (entry) entries.push(entry);
  }
  entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return entries;
}

/* ─── Analytics ─── */
async function recordShare(slug) {
  try {
    const key = qrKey(slug);
    const raw = await redis.get(key);
    if (raw) {
      const entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
      entry.shares = (entry.shares || 0) + 1;
      await redis.set(key, JSON.stringify(entry));
    }
  } catch { /* non-critical */ }
}

async function recordScanDetailed(slug, details) {
  try {
    const key = qrKey(slug);
    const raw = await redis.get(key);
    if (raw) {
      const entry = typeof raw === 'string' ? JSON.parse(raw) : raw;
      entry.scans = (entry.scans || 0) + 1;
      entry.lastScannedAt = Date.now();
      await redis.set(key, JSON.stringify(entry));
    }
    const logKey = `qr:scans:${slug}`;
    await redis.lpush(logKey, JSON.stringify(details));
    await redis.ltrim(logKey, 0, 499);
  } catch { /* non-critical */ }
}

async function getScanLog(slug, limit = 50) {
  const logKey = `qr:scans:${slug}`;
  const raw = await redis.lrange(logKey, 0, limit - 1);
  return raw.map(r => typeof r === 'string' ? JSON.parse(r) : r);
}

async function getQrAnalytics(slug) {
  const entry = await getQr(slug);
  if (!entry) return null;
  const scans = await getScanLog(slug, 500);
  const scansByDay = {};
  const scansByDevice = {};
  for (const s of scans) {
    const day = s.ts ? new Date(s.ts).toISOString().split('T')[0] : 'unknown';
    scansByDay[day] = (scansByDay[day] || 0) + 1;
    const ua = (s.ua || '').toLowerCase();
    if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
      scansByDevice.mobile = (scansByDevice.mobile || 0) + 1;
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      scansByDevice.tablet = (scansByDevice.tablet || 0) + 1;
    } else {
      scansByDevice.desktop = (scansByDevice.desktop || 0) + 1;
    }
  }
  return {
    slug: entry.slug,
    destination: entry.destination,
    createdAt: entry.createdAt,
    scans: entry.scans || 0,
    shares: entry.shares || 0,
    lastScannedAt: entry.lastScannedAt,
    scansByDay: Object.entries(scansByDay).sort((a, b) => a[0].localeCompare(b[0])),
    scansByDevice,
    recentScans: scans.slice(0, 20),
  };
}

module.exports = { createQr, getQr, updateQr, deleteQr, recordScan, recordScanDetailed, recordShare, listQrs, createProfile, getProfile, updateProfile, saveQrToProfile, removeQrFromProfile, getProfileQrs, getScanLog, getQrAnalytics };
