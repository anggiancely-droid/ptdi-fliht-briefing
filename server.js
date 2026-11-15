// Flight Weather Briefing server: static + proxy METAR/TAF + kirim PDF via email
const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const UA = { 'User-Agent': 'Mozilla/5.0 PTDI-FlightBriefing', Accept: 'text/html,text/plain' };
const STRICT = process.env.STRICT_BMKG === '1'; // 1 = hanya BMKG, tanpa pengganti

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.static(__dirname));

const grab = (txt, re) => (txt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(re) || [])[0] || null;
async function get(url) { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) }); return r.ok ? r.text() : ''; }

// 1) Portal resmi BMKG (bisa ditolak Cloudflare). 2) NOAA AWC, merelay laporan stasiun BMKG yang sama.
async function bmkg(icao) {
  try {
    const [m, t] = await Promise.all([
      get(`https://web-aviation.bmkg.go.id/web/metar_speci.php?icao=${icao}`),
      get(`https://web-aviation.bmkg.go.id/web/taf.php?icao=${icao}`)
    ]);
    const metar = grab(m, new RegExp(`(?:METAR|SPECI)\\s+${icao}\\s+\\d{6}Z[^=]*=?`));
    const taf = grab(t, new RegExp(`TAF(?:\\s+(?:AMD|COR))?\\s+${icao}\\s+\\d{6}Z[^=]*=?`));
    return metar || taf ? { metar, taf, source: 'BMKG' } : null;
  } catch { return null; }
}
async function noaa(icao) {
  try {
    const b = 'https://aviationweather.gov/api/data';
    const [m, t] = await Promise.all([get(`${b}/metar?ids=${icao}&format=raw&hours=3`), get(`${b}/taf?ids=${icao}&format=raw`)]);
    const metar = m.trim().split('\n')[0] || null, taf = t.trim() || null;
    return metar || taf ? { metar, taf, source: 'NOAA AWC (relay BMKG)' } : null;
  } catch { return null; }
}
app.get('/api/weather', async (req, res) => {
  const icao = String(req.query.icao || '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(icao)) return res.status(400).json({ error: 'ICAO tidak valid' });
  res.json((await bmkg(icao)) || (!STRICT && (await noaa(icao))) || { metar: null, taf: null, source: 'none' });
});

app.get('/api/vis', async (req, res) => {
  const ids = String(req.query.ids || '').toUpperCase().split(',').filter(x => /^[A-Z]{4}$/.test(x));
  const out = {};
  try {
    const raw = await get(`https://aviationweather.gov/api/data/metar?ids=${ids.join(',')}&format=raw&hours=3`);
    for (const l of raw.split('\n')) { const m = l.match(/^(?:METAR|SPECI)?\s*([A-Z]{4})\s\d{6}Z/); if (m && !out[m[1]]) out[m[1]] = l.trim(); }
  } catch {}
  await Promise.all(ids.filter(i => !out[i]).map(async i => { const d = await bmkg(i); if (d?.metar) out[i] = d.metar; }));
  res.json(out);
});
// proxy gambar BMKG agar bisa masuk PDF (hanya host BMKG)
app.get('/api/img', async (req, res) => {
  try {
    const u = new URL(String(req.query.u || ''));
    if (!/(^|\.)bmkg\.go\.id$/.test(u.hostname)) return res.status(400).end();
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return res.status(502).end();
    res.type(r.headers.get('content-type') || 'image/png').send(Buffer.from(await r.arrayBuffer()));
  } catch { res.status(502).end(); }
});
app.post('/send-email', async (req, res) => {
  const { email, pdf, filename } = req.body || {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '') || !pdf) return res.status(400).json({ message: 'Email atau PDF tidak valid.' });
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return res.status(500).json({ message: 'Set GMAIL_USER dan GMAIL_APP_PASSWORD dulu (lihat README).' });
  try {
    await nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } }).sendMail({
      from: `"Flight Weather Briefing" <${GMAIL_USER}>`, to: email, subject: 'Official Flight Weather Briefing Report - PTDI',
      text: 'Terlampir PDF Official Flight Weather Briefing Report sesuai permintaan Anda.',
      attachments: [{ filename: filename || 'Flight_Weather_Briefing.pdf', content: Buffer.from(pdf, 'base64'), contentType: 'application/pdf' }] });
    res.json({ message: 'Email berhasil dikirim ke ' + email });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Gagal mengirim email.' }); }
});

// proxy halaman Visibility METAR BMKG agar tampil persis di dalam iframe tanpa terblokir X-Frame-Options
app.get('/bmkg-vis', async (req, res) => {
  try {
    const r = await fetch('https://web-aviation.bmkg.go.id/web/vis-metar', { headers: UA, signal: AbortSignal.timeout(20000) });
    let html = await r.text();
    html = html.replace(/<head([^>]*)>/i, '<head$1><base href="https://web-aviation.bmkg.go.id/web/">');
    res.type('text/html').send(html);
  } catch {
    res.redirect('https://web-aviation.bmkg.go.id/web/vis-metar');
  }
});

app.listen(3000, () => console.log('Briefing berjalan di http://localhost:3000'));
