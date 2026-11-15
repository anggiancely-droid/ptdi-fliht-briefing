# Flight Briefing PTDI v2 (1 file HTML)
Semua modul ada di `index.html`. Jalankan:
- Cepat (gambar BMKG, input METAR manual): buka `index.html` langsung.
- Lengkap: `npm install && npm start` lalu buka http://localhost:3000
  (METAR/TAF otomatis + kirim PDF email).

Email: set env `GMAIL_USER` dan `GMAIL_APP_PASSWORD` (App Password 16 digit). Jangan simpan kredensial di kode.
`STRICT_BMKG=1 npm start` = METAR/TAF hanya dari BMKG, tanpa sumber pengganti.
