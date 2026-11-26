# Roblox Learning Center

## Struktur
- File HTML, `css/`, `js/`, `assets/`: frontend.
- `backend/`: Node.js + Express API, autentikasi, sesi, dan koneksi MySQL.
- `database/schema.sql`: skema database.
- `docker-compose.yml`: menjalankan backend melalui Docker.
- `.env`: konfigurasi rahasia lokal (jangan dibagikan atau dimasukkan ke Git).

## Menjalankan dengan Docker
1. Salin `.env.example` menjadi `.env` di folder utama project.
2. Isi `DB_PASSWORD` dengan password MySQL lokal kamu. Pastikan MySQL Server di Windows berjalan pada port `3307`, database `roblox_learning_center` sudah ada, dan akun MySQL boleh diakses dari Docker.
3. Jalankan dari folder utama project:
   ```powershell
   docker compose up -d --build
   ```
4. Buka `http://localhost:8000`.
5. Melihat log: `docker compose logs -f app`.
6. Menghentikan: `docker compose down`.

Backend di container mengakses MySQL lokal Windows melalui `host.docker.internal:3307`. File `.env` dibaca dari folder utama project.

## Menjalankan tanpa Docker (opsional)
Dari folder `backend/`, jalankan `npm install` lalu `npm start`. Pastikan `.env` tetap berada di folder utama project.
