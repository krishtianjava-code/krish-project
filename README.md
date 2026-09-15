# TemuKembali Sekolah

Aplikasi web Google Apps Script untuk laporan barang hilang dan temuan di sekolah. Siswa dan penemu dapat membuat laporan sesuai perannya, sedangkan guru mengelola pengambilan barang.

## Fitur

- Form laporan barang hilang/temuan dengan upload foto.
- Dashboard jumlah laporan, laporan `Belum diambil`, temuan aktif, dan laporan `Sudah diambil`.
- Pencarian berdasarkan nama barang, lokasi, deskripsi, atau pelapor.
- Filter jenis laporan dan status `Belum diambil` atau `Sudah diambil`.
- Penyimpanan otomatis ke Google Sheets.
- Status internal laporan: `Dilaporkan`, `Diproses`, dan `Selesai`, ditampilkan kepada pengguna sebagai `Belum diambil` dan `Sudah diambil`.
- Login menggunakan username admin/guru atau NIS/nama siswa dengan sesi server sementara.
- Guru dan admin dapat membuka menu `Tambah Anggota`. Guru hanya dapat menambahkan siswa, sedangkan admin dapat menambahkan siswa, guru, dan admin.
- Data akun tersimpan di sheet `Pengguna` dengan kolom peran `siswa`, `guru`, atau `admin`.
- Admin memiliki menu `List Anggota` untuk melihat semua siswa, guru, dan admin, memfilter berdasarkan peran, mengedit data akun, atau menghapus anggota.
- Kelas siswa dipilih dari opsi `X-A` sampai `X-L`, `XI-A` sampai `XI-L`, dan `XII-A` sampai `XII-L`.
- Identitas nama, NIS, dan kelas pelapor diambil otomatis dari akun yang sedang login.
- Halaman profil menampilkan identitas pengguna, ringkasan aktivitas, dan riwayat laporan milik pengguna tersebut.
- Pengguna dapat mengubah password sendiri dari halaman profil dengan memasukkan password lama terlebih dahulu. Password lama yang salah akan ditolak.
- Detail laporan dapat dibuka dari tombol `Detail` pada setiap laporan.
- Tampilan responsif untuk HP dan komputer.
- Foto laporan disimpan otomatis di folder Google Drive aplikasi dan ditampilkan pada riwayat.

## Cara memasang di Google Apps Script

1. Buka [script.google.com](https://script.google.com) lalu pilih **New project**.
2. Salin isi `Code.gs` ke file `Code.gs` pada project Apps Script.
3. Tambahkan file HTML baru bernama `Index`, lalu salin isi `Index.html` ke file tersebut.
4. Simpan project, pilih fungsi `setupApp` dari dropdown fungsi, lalu klik **Run**. Saat diminta izin, lanjutkan otorisasi memakai akun sekolah.
5. Jalankan `setupApp` sekali dari editor Apps Script. Kredensial awal admin adalah username `admin` dan password `admin1234`. Password disimpan sebagai hash di Script Properties.
6. Pilih **Deploy > New deployment**.
7. Pilih jenis **Web app**, atur:
	- **Execute as**: `Me`
	- **Who has access**: `Anyone with the link` atau `Anyone within sekolah` sesuai kebijakan sekolah.
8. Klik **Deploy**, salin **Web app URL**, lalu buka link tersebut dan masuk menggunakan kredensial admin.

Data tersimpan pada spreadsheet `Database TemuKembali Sekolah` yang dibuat otomatis. Link spreadsheet dapat dilihat dari hasil fungsi `setupApp` atau dari Google Drive akun pemilik deployment.

Foto yang diunggah disimpan pada folder Drive `TemuKembali - Foto Laporan`. Saat pertama kali ada foto, Apps Script akan meminta izin Google Drive tambahan. Jika kebijakan sekolah melarang link publik, foto tetap tersimpan dan hanya dapat dilihat oleh akun yang memiliki akses ke Drive.

## Catatan operasional

- Semua fitur aplikasi membutuhkan sesi login. Sesi berakhir setelah sekitar 6 jam atau ketika pengguna memilih `Keluar`. Token sesi disimpan di browser agar halaman tetap login setelah di-refresh; password tidak disimpan.
- Setelah login sebagai guru atau admin, gunakan menu `Tambah Anggota`. Nama anggota menjadi username dan harus unik; siswa juga dapat masuk menggunakan NIS.
- Setelah login sebagai admin, gunakan `List Anggota` untuk mengelola akun. Akun admin utama tidak dapat dihapus dari halaman tersebut.
- Admin dapat mengganti password admin dengan menjalankan `setAdminCredentials_('admin', 'password-baru')` dari editor Apps Script.
- Tombol `Tandai selesai` hanya tersedia untuk admin.
- Deployment disarankan memakai akses terbatas domain sekolah agar pemilihan peran dapat dikendalikan.

