const { createProfile, getProfile, updateProfile, saveQrToProfile, removeQrFromProfile, deleteQrFromProfile, getProfileQrs, getQrAnalytics, updateQr } = require('../lib/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  /* ── POST ── */
  if (req.method === 'POST') {
    const { action, id, name, slug, settings } = req.body || {};

    /* Save QR to profile */
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

    /* Full delete QR from profile and server */
    if (action === 'deleteQr') {
      if (!id || !slug) {
        res.status(400).json({ error: 'id and slug are required.' });
        return;
      }
      try {
        await deleteQrFromProfile(id, slug);
        res.json({ success: true });
      } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
      }
      return;
    }

    /* Update profile name */
    if (action === 'updateProfile') {
      if (!id) {
        res.status(400).json({ error: 'id is required.' });
        return;
      }
      const profile = await updateProfile(id, { name: name || 'My Profile' });
      if (!profile) {
        res.status(404).json({ error: 'Profile not found.' });
        return;
      }
      res.json(profile);
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

  /* ── PUT: update destination URL for a saved QR ── */
  if (req.method === 'PUT') {
    const { id, slug, destination, key } = req.body || {};
    if (!id || !slug || !destination || !key) {
      res.status(400).json({ error: 'id, slug, destination, and key are required.' });
      return;
    }
    try {
      const entry = await updateQr(slug, destination, key);
      /* Update saved settings content too */
      await saveQrToProfile(id, slug, { content: destination });
      res.json(entry);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
    return;
  }

  /* ── GET ── */
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

  /* ── DELETE ── */
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
