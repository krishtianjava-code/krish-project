# TemuKembali Sekolah

Aplikasi web Google Apps Script untuk laporan barang hilang dan temuan di sekolah. Siswa dan penemu dapat membuat laporan sesuai perannya, sedangkan guru mengelola pengambilan barang.

## Fitur

- Form laporan barang hilang/temuan dengan upload foto.
- Dashboard jumlah laporan, laporan `Belum diambil`, temuan aktif, dan laporan `Sudah diambil`.
- Pencarian berdasarkan nama barang, lokasi, deskripsi, atau pelapor.
- Filter jenis laporan dan status `Belum diambil` atau `Sudah diambil`.
- Penyimpanan otomatis ke Google Sheets.
- Status internal laporan: `Dilaporkan`, `Diproses`, dan `Selesai`, ditampilkan kepada pengguna sebagai `Belum diambil` dan `Sudah diambil`.
- Hak akses aplikasi: `Siswa` membuat laporan barang hilang, `Penemu` membuat atau mengubah laporan temuan, dan `Guru` mengelola semua laporan serta status pengambilan.
- Login admin sebelum aplikasi dapat diakses, dengan sesi server sementara.
- Tampilan responsif untuk HP dan komputer.
- Foto laporan disimpan otomatis di folder Google Drive aplikasi dan ditampilkan pada riwayat.

## Cara memasang di Google Apps Script

1. Buka [script.google.com](https://script.google.com) lalu pilih **New project**.
2. Salin isi `Code.gs` ke file `Code.gs` pada project Apps Script.
3. Tambahkan file HTML baru bernama `Index`, lalu salin isi `Index.html` ke file tersebut.
4. Simpan project, pilih fungsi `setupApp` dari dropdown fungsi, lalu klik **Run**. Saat diminta izin, lanjutkan otorisasi memakai akun sekolah.
5. Buat kredensial admin dengan menjalankan `setAdminCredentials_('username-admin', 'password-minimal-8-karakter')` dari editor Apps Script. Ganti kedua nilai contoh tersebut sebelum menjalankan. Password disimpan sebagai hash di Script Properties.
6. Pilih **Deploy > New deployment**.
7. Pilih jenis **Web app**, atur:
	- **Execute as**: `Me`
	- **Who has access**: `Anyone with the link` atau `Anyone within sekolah` sesuai kebijakan sekolah.
8. Klik **Deploy**, salin **Web app URL**, lalu buka link tersebut dan masuk menggunakan kredensial admin.

Data tersimpan pada spreadsheet `Database TemuKembali Sekolah` yang dibuat otomatis. Link spreadsheet dapat dilihat dari hasil fungsi `setupApp` atau dari Google Drive akun pemilik deployment.

Foto yang diunggah disimpan pada folder Drive `TemuKembali - Foto Laporan`. Saat pertama kali ada foto, Apps Script akan meminta izin Google Drive tambahan. Jika kebijakan sekolah melarang link publik, foto tetap tersimpan dan hanya dapat dilihat oleh akun yang memiliki akses ke Drive.

## Catatan operasional

- Semua fitur aplikasi membutuhkan sesi login admin. Sesi berakhir setelah sekitar 6 jam atau ketika admin memilih `Keluar`.
- Pemilih peran masih digunakan untuk menentukan hak akses operasi laporan di dalam aplikasi. Batasi akses Web App ke domain sekolah untuk perlindungan tambahan.
- Jika password admin perlu diganti, jalankan kembali `setAdminCredentials_` dari editor Apps Script, lalu deploy versi terbaru bila deployment tidak memakai versi head.
- Tombol `Tandai selesai` hanya tersedia untuk peran `Guru` dan meminta nama pengelola.
- Deployment disarankan memakai akses terbatas domain sekolah agar pemilihan peran dapat dikendalikan.

