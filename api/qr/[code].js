const { getQr, updateQr, deleteQr, recordScanDetailed, recordShare, getQrAnalytics } = require('../../lib/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { code } = req.query;

  if (!code) {
    res.status(400).json({ error: 'Code is required.' });
    return;
  }

  /* ── GET: redirect or analytics ── */
  if (req.method === 'GET') {
    try {
      /* Return analytics JSON if ?analytics=1 */
      if (req.query.analytics === '1') {
        const data = await getQrAnalytics(code);
        if (!data) {
          res.status(404).json({ error: 'QR code not found.' });
          return;
        }
        res.json(data);
        return;
      }

      const entry = await getQr(code);
      if (!entry) {
        res.status(404).send('QR code not found.');
        return;
      }

      const ua = req.headers['user-agent'] || '';
      const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
      const referer = req.headers['referer'] || '';
      await recordScanDetailed(code, { ts: Date.now(), ua, ip, referer });
      res.writeHead(302, { Location: entry.destination });
      res.end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  /* ── POST: share action ── */
  if (req.method === 'POST') {
    const { action } = req.body || {};
    if (action === 'share') {
      try {
        await recordShare(code);
        const entry = await getQr(code);
        res.json({ shares: entry?.shares || 0 });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
      return;
    }
    res.status(400).json({ error: 'Invalid action.' });
    return;
  }

  /* ── PUT: update destination ── */
  if (req.method === 'PUT') {
    const { destination, key } = req.body || {};
    if (!destination || !key) {
      res.status(400).json({ error: 'destination and key are required.' });
      return;
    }

    try {
      const entry = await updateQr(code, destination, key);
      res.json(entry);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
    return;
  }

  /* ── DELETE ── */
  if (req.method === 'DELETE') {
    const { key } = req.body || {};
    if (!key) {
      res.status(400).json({ error: 'key is required.' });
      return;
    }

    try {
      await deleteQr(code, key);
      res.json({ success: true });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed.' });
};
