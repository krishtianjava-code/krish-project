# TemuKembali Sekolah

Aplikasi web Google Apps Script untuk laporan barang hilang dan temuan di sekolah. Siswa dan guru dapat membuat laporan, mencari laporan, serta menandai laporan yang sudah selesai.

## Fitur

- Form laporan barang hilang/temuan dengan upload foto.
- Dashboard jumlah laporan, laporan aktif, temuan, dan laporan selesai.
- Pencarian berdasarkan nama barang, lokasi, deskripsi, atau pelapor.
- Filter jenis laporan dan status.
- Penyimpanan otomatis ke Google Sheets.
- Status laporan: `Dilaporkan`, `Diproses`, dan `Selesai`.
- Tampilan responsif untuk HP dan komputer.
- Foto laporan disimpan otomatis di folder Google Drive aplikasi dan ditampilkan pada riwayat.

## Cara memasang di Google Apps Script

1. Buka [script.google.com](https://script.google.com) lalu pilih **New project**.
2. Salin isi `Code.gs` ke file `Code.gs` pada project Apps Script.
3. Tambahkan file HTML baru bernama `Index`, lalu salin isi `Index.html` ke file tersebut.
4. Simpan project, pilih fungsi `setupApp` dari dropdown fungsi, lalu klik **Run**. Saat diminta izin, lanjutkan otorisasi memakai akun sekolah.
5. Pilih **Deploy > New deployment**.
6. Pilih jenis **Web app**, atur:
	- **Execute as**: `Me`
	- **Who has access**: `Anyone with the link` atau `Anyone within sekolah` sesuai kebijakan sekolah.
7. Klik **Deploy**, salin **Web app URL**, lalu bagikan link tersebut kepada guru dan siswa.

Data tersimpan pada spreadsheet `Database TemuKembali Sekolah` yang dibuat otomatis. Link spreadsheet dapat dilihat dari hasil fungsi `setupApp` atau dari Google Drive akun pemilik deployment.

Foto yang diunggah disimpan pada folder Drive `TemuKembali - Foto Laporan`. Saat pertama kali ada foto, Apps Script akan meminta izin Google Drive tambahan. Jika kebijakan sekolah melarang link publik, foto tetap tersimpan dan hanya dapat dilihat oleh akun yang memiliki akses ke Drive.

## Catatan operasional

- Versi ini menggunakan nama dan kontak yang diisi pelapor, tanpa login akun sekolah.
- Tombol `Tandai selesai` meminta nama pengelola. Untuk penggunaan produksi, batasi akses Web App ke domain sekolah dan tambahkan autentikasi/daftar guru.
- Link Web App tidak bisa dibuat dari repositori ini secara otomatis karena deployment harus memakai akun Google pemilik spreadsheet dan Apps Script.
