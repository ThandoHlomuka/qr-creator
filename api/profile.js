const { createProfile, getProfile, saveQrToProfile, removeQrFromProfile, getProfileQrs, getQrAnalytics } = require('../lib/kv');

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  /* ── POST: create profile or save QR to profile ── */
  if (req.method === 'POST') {
    const { action, id, name, slug, settings } = req.body || {};

    if (action === 'save') {
      if (!id || !slug) {
        res.status(400).json({ error: 'id and slug are required.' });
        return;
      }
      const profile = await getProfile(id);
      if (!profile) {
        res.status(404).json({ error: 'Profile not found.' });
        return;
      }
      await saveQrToProfile(id, slug, settings || {});
      const qrs = await getProfileQrs(id);
      res.json({ success: true, qrCount: qrs.length });
      return;
    }

    /* Default: create/get profile */
    if (!id) {
      res.status(400).json({ error: 'id is required.' });
      return;
    }
    let profile = await getProfile(id);
    if (!profile) {
      profile = await createProfile(id, name || 'My Profile');
    }
    res.json(profile);
    return;
  }

  /* ── GET: profile with saved QRs and aggregate stats ── */
  if (req.method === 'GET') {
    const { id, analytics } = req.query;
    if (!id) {
      res.status(400).json({ error: 'id is required.' });
      return;
    }

    const profile = await getProfile(id);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    const qrs = await getProfileQrs(id);
    const totalScans = qrs.reduce((s, q) => s + (q.scans || 0), 0);
    const totalShares = qrs.reduce((s, q) => s + (q.shares || 0), 0);

    /* If ?analytics=slug, get analytics for that slug */
    if (analytics) {
      const data = await getQrAnalytics(analytics);
      if (!data) {
        res.status(404).json({ error: 'QR code not found.' });
        return;
      }
      res.json({ profile, qrs, totalScans, totalShares, analytics: data });
      return;
    }

    res.json({ profile, qrs, totalScans, totalShares });
    return;
  }

  /* ── DELETE: remove QR from profile ── */
  if (req.method === 'DELETE') {
    const { id, slug } = req.query;
    if (!id || !slug) {
      res.status(400).json({ error: 'id and slug are required.' });
      return;
    }
    await removeQrFromProfile(id, slug);
    res.json({ success: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed.' });
};
