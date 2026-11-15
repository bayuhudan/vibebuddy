# 🌟 VibeBuddy - Web Platform Teman Virtual & Admin Hub

Platform web interaktif teman virtual dengan autentikasi SQL Database terintegrasi, sistem leveling persahabatan (XP), jurnal emosi (Mood Tracker), Lounge Komunitas, serta **Dashboard Admin Khusus** yang diproteksi password rahasia.

---

## 📌 Penjelasan Struktur Beranda & Pengguna

1. **👥 Teman Server (Pengguna Terdaftar di SQL):**
   - Beranda utama menampilkan **kartu pengguna nyata** yang terdaftar di database server.
   - **Kondisi Awal (Bersih / Kosong):** Jika belum ada pengguna umum yang mendaftar, beranda menampilkan status kosong (*"Belum Ada Teman Terdaftar di Server"*).
   - **Otomatis Sinkron:** Saat ada pengguna baru mendaftar melalui form pendaftaran, kartu profil mereka akan langsung muncul di beranda utama.
   - **Penghapusan oleh Admin:** Jika akun pengguna dihapus oleh Admin di Dashboard Admin, kartu pengguna tersebut akan **langsung terhapus dan hilang dari beranda utama**.

2. **🤖 Bot AI Virtual Teman (Karakter Bawaan Sistem):**
   - Terpisah di tab khusus **"Bot AI Virtual"** sebagai asisten bot pintar bawaan server untuk seru-seruan (bukan akun pengguna terdaftar):
     - 🦊 **Rian si Roaster** (Sarkas & Savage)
     - 🌸 **Bella si Melow** (Pendengar Curhat Setia)
     - ⚡ **Devan si Ambis** (Motivator Anti-Mager)
     - 🎀 **Hana si Wibu** (Ceria & Anime Lover)
     - ☕ **Pak Budi Bapack** (Jokes Bapak-Bapak)
     - 🔮 **Ki Ageng Mistik** (Ramalan Hoki & Khodam)

---

## 🛡️ Akses Dashboard Admin
- **URL Admin:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Akun Login Admin:** `admin` / `admin123`
- **Password Rahasia Khusus Dashboard:** `SUPERADMIN2026`

---

## 🚀 Cara Menjalankan
```bash
npm start
```
Buka browser di: [http://localhost:3000](http://localhost:3000)
