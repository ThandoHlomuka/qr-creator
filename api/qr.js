const { createQr, listQrs } = require('../lib/kv');

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { slug, destination, key } = req.body || {};

    if (!slug || !destination || !key) {
      res.status(400).json({ error: 'slug, destination, and key are required.' });
      return;
    }

    if (!/^[a-zA-Z0-9_-]{3,}$/.test(slug)) {
      res.status(400).json({ error: 'Slug must be at least 3 characters (letters, numbers, hyphens, underscores).' });
      return;
    }

    if (key.length < 6) {
      res.status(400).json({ error: 'Management key must be at least 6 characters.' });
      return;
    }

    try {
      const entry = await createQr(slug, destination, key);
      const redirectUrl = `${SITE_URL}/api/qr/${slug}`;
      res.status(201).json({ ...entry, redirectUrl });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'GET') {
    try {
      const qrs = await listQrs();
      res.json({ qrs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed.' });
};
