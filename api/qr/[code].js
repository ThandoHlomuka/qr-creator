const { getQr, updateQr, deleteQr, recordScan } = require('../../lib/kv');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
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

  /* ── GET: redirect ── */
  if (req.method === 'GET') {
    try {
      const entry = await getQr(code);
      if (!entry) {
        res.status(404).send('QR code not found.');
        return;
      }

      await recordScan(code);
      res.writeHead(302, { Location: entry.destination });
      res.end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
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
