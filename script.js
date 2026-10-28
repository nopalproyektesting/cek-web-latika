'use strict';
/* =====================================================================
   KOTAK KELAS - script.js

   DAFTAR ISI
   1.  Pengaturan (bagian yang paling mudah kamu ubah)
   2.  Utilitas
   3.  Dialog konfirmasi
   4.  Lapisan Storage      (satu-satunya pintu akses data)
   5.  Autentikasi          (hash password, sesi)
   6.  Validasi & link WhatsApp
   7.  Kompres gambar
   8.  Hitung harga
   9.  State & helper render
   10. Komponen             (kartu produk, daftar, footer, hero)
   11. Halaman (view)       (satu fungsi = satu halaman)
   12. Kalkulator harga & preview foto
   13. Aksi form            (pesan, rating, login, daftar, produk)
   14. Event global
   15. Animasi saat scroll
   16. Router (hash)
   ===================================================================== */


/* =====================================================================
   1. PENGATURAN
   Ubah isi daftar di bawah untuk mengganti teks tanpa menyentuh logika.
   ===================================================================== */

// Kategori produk: [nama, nama icon Lucide]
const CATS = [
  ['Makanan', 'utensils'],
  ['Minuman', 'cup-soda'],
  ['Camilan', 'cookie'],
  ['Kue', 'cake-slice']
];

// Hero beranda: deskripsi berganti otomatis (minimal 1 item)
const HERO_DETIK = 5; // jeda ganti deskripsi (detik)
const HERO = [
  { lencana: 'PROMO KELAS',    judul: 'Jajanan Karya Siswa SMK',         teks: 'Beli langsung dari teman sekolah, ready atau pre-order.' },
  { lencana: 'MUDAH DIPESAN',  judul: 'Pesan Lewat WhatsApp',            teks: 'Pilih produk, isi form singkat, dan pesananmu langsung terkirim ke penjual.' },
  { lencana: 'RATING PENJUAL', judul: 'Belanja dari Penjual Terpercaya', teks: 'Lihat rating dan ulasan penjual sebelum kamu memesan.' },
  { lencana: 'JUALAN KELAS',   judul: 'Punya Produk Hasil Praktek?',     teks: 'Daftar jadi penjual dan hitung harga untungmu dengan kalkulator.' }
];

// Janji Kami (tampil di footer): [icon Lucide, judul, keterangan]
const JANJI = [
  ['shield-check',    'Dibuat siswa sendiri', 'Setiap produk hasil praktek dan usaha kelas.'],
  ['clock',           'Ready atau PO jelas',  'Stok dan estimasi tanggal siap selalu tertulis.'],
  ['heart-handshake', 'Rating jujur',         'Ulasan hanya dari pembeli yang benar-benar memesan.']
];


/* =====================================================================
   2. UTILITAS
   ===================================================================== */

// Pintasan querySelector
const $ = (selector, root = document) => root.querySelector(selector);

// Escape input pengguna sebelum masuk ke HTML (cegah XSS)
const esc = (teks) => String(teks ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Format rupiah: 12000 -> "Rp 12.000"
const rp = (angka) => 'Rp ' + Number(angka || 0).toLocaleString('id-ID');

// ID unik sederhana
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Notifikasi singkat di atas layar
const toast = (pesan) => {
  const el = $('#toast');
  el.textContent = pesan;
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), 2800);
};

// Tampilkan pesan error di bawah form (elemen #err)
const fail = (pesan) => { $('#err').textContent = pesan; };


/* =====================================================================
   3. DIALOG KONFIRMASI
   Pengganti confirm() bawaan browser (yang tidak bisa diberi CSS).
   Pemakaian: konfirmasi({ judul, teks, ya, batal, icon }).then(ok => { ... })
   ===================================================================== */
function konfirmasi({ judul, teks, ya = 'Ya', batal = 'Batal', icon = 'trash-2' }) {
  return new Promise((selesai) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<div class="dlg glass" role="alertdialog" aria-modal="true" aria-labelledby="dj" aria-describedby="dt">
      <div class="dlg-ic"><i data-lucide="${esc(icon)}"></i></div>
      <h3 id="dj">${esc(judul)}</h3>
      <p id="dt">${esc(teks)}</p>
      <div class="dlg-btns">
        <button type="button" class="btn o" data-r="0">${esc(batal)}</button>
        <button type="button" class="btn red" data-r="1">${esc(ya)}</button>
      </div></div>`;
    document.body.appendChild(modal);
    lucide.createIcons();

    const fokusAwal = document.activeElement;

    const tutup = (hasil) => {
      document.removeEventListener('keydown', tombolEsc);
      modal.classList.remove('on');
      setTimeout(() => {
        modal.remove();
        if (fokusAwal && fokusAwal.focus) fokusAwal.focus();
      }, 300);
      selesai(hasil);
    };
    const tombolEsc = (e) => { if (e.key === 'Escape') tutup(false); };

    modal.addEventListener('click', (e) => {
      const tombol = e.target.closest('[data-r]');
      if (tombol) tutup(tombol.dataset.r === '1');
      else if (e.target === modal) tutup(false); // klik di luar = batal
    });
    document.addEventListener('keydown', tombolEsc);
    requestAnimationFrame(() => {
      modal.classList.add('on');
      modal.querySelector('[data-r="0"]').focus();
    });
  });
}


/* =====================================================================
   4. LAPISAN STORAGE
   Semua akses data HARUS lewat objek ini.
   TODO-DB: ganti isi tiap fungsi dengan Firebase/Supabase (async),
            nama fungsi dibiarkan sama supaya bagian lain tidak berubah.
   ===================================================================== */
const Storage = {
  // Ambil semua data satu koleksi (array)
  getAll(koleksi) {
    try { return JSON.parse(localStorage.getItem(koleksi)) || []; }
    catch { return []; }
  },

  // Simpan; tangani penyimpanan penuh dengan pesan ramah
  _save(koleksi, nilai) {
    try {
      localStorage.setItem(koleksi, JSON.stringify(nilai));
      return true;
    } catch (e) {
      toast(e.name === 'QuotaExceededError' ? 'Penyimpanan penuh, kurangi jumlah foto' : 'Gagal menyimpan data');
      return false;
    }
  },

  getById(koleksi, id) { return this.getAll(koleksi).find((x) => x.id === id); },

  add(koleksi, data) {
    data.id = data.id || uid();
    const semua = this.getAll(koleksi);
    semua.push(data);
    return this._save(koleksi, semua) ? data : null;
  },

  update(koleksi, id, data) {
    return this._save(koleksi, this.getAll(koleksi).map((x) => (x.id === id ? { ...x, ...data } : x)));
  },

  remove(koleksi, id) {
    return this._save(koleksi, this.getAll(koleksi).filter((x) => x.id !== id));
  },

  // Untuk objek tunggal (mis. sesi login)
  getObj(kunci) {
    try { return JSON.parse(localStorage.getItem(kunci)); }
    catch { return null; }
  },
  setObj(kunci, nilai) { return this._save(kunci, nilai); },
  delObj(kunci) { localStorage.removeItem(kunci); }
};


/* =====================================================================
   5. AUTENTIKASI
   TODO-DB: hash SHA-256 ini HANYA untuk demo. Saat pindah ke database,
            pakai autentikasi bawaan (Firebase Auth / Supabase Auth).
   ===================================================================== */
async function sha256(teks) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Penjual yang sedang login (atau undefined/null jika belum)
const me = () => {
  const sesi = Storage.getObj('kk_session');
  return sesi && Storage.getById('kk_sellers', sesi.sellerId);
};


/* =====================================================================
   6. VALIDASI & LINK WHATSAPP
   ===================================================================== */

// 08xx -> 628xx
function toWA(nomor) {
  let d = String(nomor).replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d;
}

const validWA = (nomor) => /^628\d{8,11}$/.test(toWA(nomor));

// Link wa.me berisi pesan pesanan yang sudah di-encode
function waLink(pesanan, produk, penjual) {
  const teks = `Halo ${penjual.toko}, saya mau pesan:\n`
    + `Produk: ${produk.nama}\n`
    + `Jumlah: ${pesanan.jumlah}\n`
    + `Total: ${rp(pesanan.total)}\n`
    + `Tipe: ${produk.status === 'ready' ? 'Ready' : 'Pre-Order'}\n`
    + `Nama: ${pesanan.namaPembeli}\n`
    + `Kelas: ${pesanan.kelasPembeli}\n`
    + `Catatan: ${pesanan.catatan || '-'}`;
  return `https://wa.me/${toWA(penjual.wa)}?text=${encodeURIComponent(teks)}`;
}


/* =====================================================================
   7. KOMPRES GAMBAR
   Validasi JPG/PNG/WebP maks 5 MB, lalu kecilkan lewat canvas
   (lebar maks `maxW`, kualitas JPEG 0.7) dan keluarkan base64.
   ===================================================================== */
function compress(file, maxW) {
  return new Promise((ok, tolak) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return tolak('Hanya file JPG/PNG/WebP');
    if (file.size > 5 * 1024 * 1024) return tolak('Ukuran foto maksimal 5 MB');

    const pembaca = new FileReader();
    pembaca.onload = () => {
      const gambar = new Image();
      gambar.onload = () => {
        const w = Math.min(maxW, gambar.width);
        const h = gambar.height * w / gambar.width;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(gambar, 0, 0, w, h);
        ok(canvas.toDataURL('image/jpeg', 0.7));
      };
      gambar.onerror = () => tolak('File gambar rusak');
      gambar.src = pembaca.result;
    };
    pembaca.readAsDataURL(file);
  });
}


/* =====================================================================
   8. HITUNG HARGA
   Margin dihitung dari HARGA JUAL: harga = modal / (1 - margin/100),
   dibulatkan ke atas kelipatan Rp500.
   ===================================================================== */
const hargaRek = (modal, margin) => Math.ceil(modal / (1 - margin / 100) / 500) * 500;


/* =====================================================================
   9. STATE & HELPER RENDER
   ===================================================================== */
const st = { q: '', kat: '' };   // filter aktif: kata kunci & kategori
let tmp = { fotos: [] };         // foto sementara saat upload

const sellerOf = (id) => Storage.getById('kk_sellers', id);

// Rata-rata rating & jumlah ulasan satu penjual
function ratingOf(sellerId) {
  const ulasan = Storage.getAll('kk_reviews').filter((x) => x.sellerId === sellerId);
  return {
    n: ulasan.length,
    avg: ulasan.length ? ulasan.reduce((total, x) => total + x.rating, 0) / ulasan.length : 0
  };
}

// Bintang + angka rating penjual
const star = (sellerId) => {
  const r = ratingOf(sellerId);
  return `<span class="rate"><i data-lucide="star"></i>${r.n ? r.avg.toFixed(1) + ' (' + r.n + ')' : 'Baru'}</span>`;
};

// Gambar, atau placeholder (gradient + icon "image") jika kosong
const img = (src, alt, kelas = '') => src
  ? `<img class="${kelas}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">`
  : `<div class="ph ${kelas}" role="img" aria-label="${esc(alt)}"><i data-lucide="image"></i></div>`;

// Input berlabel
const fld = (nama, label, tipe, nilai = '', extra = '') =>
  `<label>${label}<input class="in" name="${nama}" type="${tipe}" value="${esc(nilai)}" ${extra}></label>`;

// Input berlabel + ikon di kiri
const fldi = (nama, label, tipe, ikon, nilai = '', extra = '') =>
  `<label>${label}<span class="inp"><i data-lucide="${ikon}"></i><input class="in" name="${nama}" type="${tipe}" value="${esc(nilai)}" ${extra}></span></label>`;

// Tombol kembali
const back = (href) => `<a class="back" href="${href}" aria-label="Kembali"><i data-lucide="arrow-left"></i></a>`;

const nf = () => '<p class="empty">Halaman tidak ditemukan.</p>';

// Panel samping dekoratif login/daftar (hanya tampil di desktop)
const authSide = `<aside class="auth-side"><h2>Jualan hasil praktek jadi lebih mudah</h2><ul>
  <li><i data-lucide="calculator"></i>Hitung harga jual dengan kalkulator margin</li>
  <li><i data-lucide="camera"></i>Upload foto produk langsung dari HP</li>
  <li><i data-lucide="star"></i>Kumpulkan rating dari pembeli</li></ul></aside>`;

// Header biru login/daftar (hanya tampil di HP/tablet)
function authTop(aktif) {
  const login = aktif === 'login';
  return `<div class="auth-top">
    <a class="auth-back" href="#/" aria-label="Kembali ke beranda"><i data-lucide="arrow-left"></i></a>
    <span class="auth-brand"><i data-lucide="package"></i>Kotak Kelas</span>
    <span class="auth-ic"><i data-lucide="${login ? 'store' : 'sparkles'}"></i></span>
    <h1>${login ? 'Halo, Penjual!' : 'Buka Tokomu'}</h1>
    <p>${login ? 'Masuk untuk kelola produk dan pesananmu.' : 'Daftar dan mulai jualan hasil praktek kelasmu.'}</p></div>`;
}


/* =====================================================================
   10. KOMPONEN
   ===================================================================== */

// Kartu produk
function cardP(p) {
  const s = sellerOf(p.sellerId) || {};
  return `<a class="card glass rv" href="#/produk/${p.id}">
    ${img(p.fotos[0], p.nama, 'pimg')}
    <span class="badge ${p.status}">${p.status === 'ready' ? 'READY' : 'PRE-ORDER'}</span>
    <div class="pb"><h3>${esc(p.nama)}</h3><b>${rp(p.harga)}</b><small>${esc(s.toko)} · ${esc(s.kelas)}</small>${star(p.sellerId)}</div></a>`;
}

// Daftar produk setelah filter kata kunci & kategori; urut terlaris (paling banyak dipesan)
function listP() {
  const kataKunci = st.q.toLowerCase();
  const jumlahPesanan = (id) => Storage.getAll('kk_orders').filter((o) => o.productId === id).length;

  const hasil = Storage.getAll('kk_products')
    .filter((p) => {
      const s = sellerOf(p.sellerId) || {};
      const cocokKategori = !st.kat || p.kategori === st.kat;
      const cocokKata = !kataKunci || [p.nama, s.toko, s.nama].some((x) => String(x || '').toLowerCase().includes(kataKunci));
      return cocokKategori && cocokKata;
    })
    .sort((x, y) => jumlahPesanan(y.id) - jumlahPesanan(x.id));

  if (!Storage.getAll('kk_products').length) {
    return '<p class="empty">Belum ada produk. Jadilah penjual pertama lewat menu Jual.</p>';
  }
  return hasil.length ? hasil.map(cardP).join('') : '<p class="empty">Produk tidak ditemukan.</p>';
}

// Chip filter kategori
const chips = () => [['', 'Semua'], ...CATS]
  .map(([nilai, label]) => `<button class="chip ${st.kat === nilai ? 'on' : ''}" data-c="kat" data-v="${nilai}">${label}</button>`)
  .join('');

// Search bar + chip kategori
const fbar = () => `<label class="search glass"><i data-lucide="search"></i><input id="q" type="search" placeholder="Cari produk atau penjual" aria-label="Cari produk atau penjual" value="${esc(st.q)}"></label>
  <div class="chips" id="chips">${chips()}</div>`;

// Render ulang daftar produk + chip tanpa mengganti seluruh halaman
function refresh() {
  $('#list').innerHTML = listP();
  $('#chips').innerHTML = chips();
  lucide.createIcons();
  reveal();
}

// Footer: brand + Janji Kami + menu
function vFooter() {
  const janji = JANJI
    .map(([ikon, judul, ket]) => `<li><span class="sf-ic"><i data-lucide="${ikon}"></i></span><div><b>${judul}</b><small>${ket}</small></div></li>`)
    .join('');
  const menu = [['#/', 'house', 'Beranda'], ['#/produk', 'layout-grid', 'Produk'], ['#/pesanan', 'clipboard-list', 'Pesanan'], ['#/dashboard', 'store', 'Jual']]
    .map(([href, ikon, label]) => `<a href="${href}"><i data-lucide="${ikon}"></i>${label}</a>`)
    .join('');
  return `<footer class="sf"><div class="sf-in">
    <div class="sf-brand"><a class="logo" href="#/"><i data-lucide="package"></i>Kotak Kelas</a><p>Marketplace mini untuk siswa SMK yang berjualan produk hasil praktek dan usaha kelas.</p></div>
    <div><h2>Janji Kami</h2><ul class="sf-list">${janji}</ul></div>
    <nav aria-label="Menu footer"><h2>Menu</h2><div class="sf-links">${menu}</div></nav></div>
    <p class="sf-bar">Kotak Kelas - Karya siswa, untuk siswa.</p></footer>`;
}

// ----- Hero: deskripsi berganti otomatis -----
let heroI = 0;
let heroTimer;

function heroGo(index) {
  const slide = document.querySelectorAll('.hs');
  const titik = document.querySelectorAll('.dot');
  if (!slide.length) return;

  heroI = (index + slide.length) % slide.length;
  slide.forEach((el, n) => {
    const lama = el.classList.contains('on');
    el.classList.toggle('on', n === heroI);
    // slide yang keluar diberi kelas "out" sebentar supaya bergerak ke atas
    if (lama && n !== heroI) {
      el.classList.add('out');
      setTimeout(() => el.classList.remove('out'), 900);
    }
  });
  titik.forEach((el, n) => {
    el.classList.toggle('on', n === heroI);
    el.setAttribute('aria-current', n === heroI);
  });
}

function heroStart() {
  clearInterval(heroTimer);
  // Tanpa auto-ganti jika hanya 1 deskripsi atau pengguna memilih mengurangi animasi
  if (document.querySelectorAll('.hs').length < 2 || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  heroTimer = setInterval(() => heroGo(heroI + 1), HERO_DETIK * 1000);
}


/* =====================================================================
   11. HALAMAN (VIEW)
   Setiap fungsi v... mengembalikan string HTML untuk satu halaman.
   ===================================================================== */

// Beranda
function vHome() {
  const penjualTerbaik = Storage.getAll('kk_sellers')
    .map((s) => ({ s, r: ratingOf(s.id) }))
    .sort((a, b) => b.r.avg - a.r.avg);

  const slide = HERO
    .map((h, i) => `<div class="hs ${i ? '' : 'on'}"><span class="badge ready">${esc(h.lencana)}</span><h1>${esc(h.judul)}</h1><p>${esc(h.teks)}</p></div>`)
    .join('');
  const titik = HERO.length > 1
    ? `<div class="dots">${HERO.map((_, i) => `<button class="dot ${i ? '' : 'on'}" data-c="hero" data-i="${i}" aria-label="Tampilkan deskripsi ${i + 1}"></button>`).join('')}</div>`
    : '';

  return `<section class="hero rv"><div class="hero-t">
      <div class="hslides">${slide}</div>
      <div class="hbtn"><a class="btn y" href="#/produk">Belanja Sekarang</a>${titik}</div></div>
    <div class="hero-art" aria-hidden="true">
      <span class="ob ob1"><i data-lucide="cake-slice"></i></span>
      <span class="ob ob2"><i data-lucide="cup-soda"></i></span>
      <span class="ob ob3"><i data-lucide="cookie"></i></span>
      <span class="ob ob4"><i data-lucide="utensils"></i></span></div></section>
  ${fbar()}
  <h2>Kategori</h2>
  <div class="cats">${CATS.map(([nama, ikon]) => `<button class="cat glass" data-c="kat" data-v="${nama}"><i data-lucide="${ikon}"></i>${nama}</button>`).join('')}</div>
  <h2>Produk Terlaris</h2>
  <div class="grid" id="list">${listP()}</div>
  <h2>Penjual Terbaik</h2>
  <div class="sellers">${penjualTerbaik.map(({ s }) => `<a class="glass box seller rv" href="#/penjual/${s.id}">${img(s.foto, s.toko, 'av')}<div><h3>${esc(s.toko)}</h3><small>${esc(s.nama)} · ${esc(s.kelas)}</small>${star(s.id)}</div></a>`).join('') || '<p class="empty">Belum ada penjual terdaftar.</p>'}</div>
  ${vFooter()}`;
}

// Semua produk (di desktop: filter di kiri)
const vProduk = () => `<h1>Semua Produk</h1>
  <div class="shop"><aside class="filters">${fbar()}</aside><div class="grid" id="list">${listP()}</div></div>`;

// Detail produk
function vDetail(id) {
  const p = Storage.getById('kk_products', id);
  if (!p) return nf();
  const s = sellerOf(p.sellerId) || {};
  const foto = p.fotos.length ? p.fotos : [''];
  return `${back('#/produk')}
  <div class="dwrap">
    <div class="dl"><div class="gal glass">${foto.map((f) => img(f, p.nama, 'gimg')).join('')}</div></div>
    <div class="dr">
      <div class="glass box rv">
        <span class="badge ${p.status}">${p.status === 'ready' ? 'READY' : 'PRE-ORDER'}</span>
        <h1>${esc(p.nama)}</h1><b class="price">${rp(p.harga)}</b><p>${esc(p.deskripsi)}</p>
        <p class="info"><i data-lucide="${p.status === 'ready' ? 'package' : 'clock'}"></i>${p.status === 'ready' ? 'Stok: ' + p.stok : 'Estimasi siap: ' + esc(p.estimasiPO)}</p>
        <a class="btn y" href="#/pesan/${p.id}">${p.status === 'ready' ? 'Beli Sekarang' : 'Pre-Order'}</a>
      </div>
      <div class="glass box seller rv">${img(s.foto, s.toko, 'av')}<div><h3>${esc(s.toko)}</h3><small>${esc(s.nama)} · ${esc(s.kelas)}</small>${star(s.id)}</div></div>
      <div class="row">
        <a class="btn" target="_blank" rel="noopener" href="https://wa.me/${toWA(s.wa)}"><i data-lucide="message-circle"></i>WhatsApp</a>
        <a class="btn o" href="#/penjual/${s.id}">Profil penjual</a>
      </div>
    </div></div>`;
}

// Profil penjual
function vSeller(id) {
  const s = sellerOf(id);
  if (!s) return nf();
  const ulasan = Storage.getAll('kk_reviews').filter((x) => x.sellerId === id).reverse();
  const produk = Storage.getAll('kk_products').filter((p) => p.sellerId === id);
  return `${back('#/')}
  <div class="split">
    <aside class="side"><div class="glass box c">${img(s.foto, s.toko, 'av big')}<h1>${esc(s.toko)}</h1><small>${esc(s.nama)} · ${esc(s.kelas)}</small><p>${esc(s.deskripsi)}</p>${star(id)}</div></aside>
    <div class="main">
      <h2>Ulasan (${ulasan.length})</h2>
      <div class="revs">${ulasan.map((x) => `<div class="glass box"><b>${esc(x.namaPembeli)}</b> <span class="rate"><i data-lucide="star"></i>${x.rating}/5</span><p>${esc(x.komentar)}</p></div>`).join('') || '<p class="empty">Belum ada ulasan.</p>'}</div>
      <h2>Produk Aktif</h2>
      <div class="grid">${produk.map(cardP).join('') || '<p class="empty">Belum ada produk.</p>'}</div>
    </div></div>`;
}

// Form pesan
function vPesan(id) {
  const p = Storage.getById('kk_products', id);
  if (!p) return nf();
  const s = sellerOf(p.sellerId) || {};
  return `${back('#/produk/' + id)}
  <div class="split">
    <aside class="side sum glass box c">${img(p.fotos[0], p.nama, 'sumimg')}<span class="badge ${p.status}">${p.status === 'ready' ? 'READY' : 'PRE-ORDER'}</span><h2>${esc(p.nama)}</h2><b class="price">${rp(p.harga)}</b><small>${esc(s.toko)} · ${esc(s.kelas)}</small>
      <p class="info"><i data-lucide="${p.status === 'ready' ? 'package' : 'clock'}"></i>${p.status === 'ready' ? 'Stok: ' + p.stok : 'Estimasi siap: ' + esc(p.estimasiPO)}</p></aside>
    <form class="glass box" data-f="pesan" data-id="${p.id}" novalidate>
      <h1>${p.status === 'ready' ? 'Beli' : 'Pre-Order'}: ${esc(p.nama)}</h1>
      ${fld('nama', 'Nama pembeli', 'text')}
      ${fld('kelas', 'Kelas pembeli', 'text')}
      ${fld('jumlah', 'Jumlah', 'number', '1', 'min="1"')}
      <label>Catatan (opsional)<textarea class="in" name="catatan"></textarea></label>
      <p class="err" id="err"></p>
      <button class="btn y">Pesan via WhatsApp</button>
    </form></div>`;
}

// Riwayat pesanan di perangkat ini
function vPesanan() {
  const idSaya = Storage.getObj('kk_my') || [];
  const pesanan = Storage.getAll('kk_orders').filter((o) => idSaya.includes(o.id)).reverse();
  const kartu = pesanan.map((o) => {
    const p = Storage.getById('kk_products', o.productId);
    return `<div class="glass box rv"><b>${esc(p ? p.nama : 'Produk dihapus')}</b><p>${o.jumlah} x · ${rp(o.total)}</p><small>${new Date(o.tanggal).toLocaleDateString('id-ID')}</small>
    ${o.sudahDinilai ? '<p class="info"><i data-lucide="star"></i>Sudah dinilai</p>' : `<a class="btn y sm" href="#/rating/${o.id}">Beri Rating</a>`}</div>`;
  }).join('');
  return `<h1>Pesanan Saya</h1><div class="cards2">${kartu || '<p class="empty">Belum ada pesanan di perangkat ini.</p>'}</div>`;
}

// Form rating penjual
function vRating(id) {
  const o = Storage.getById('kk_orders', id);
  if (!o) return nf();
  const s = sellerOf(o.sellerId) || {};
  const bintang = [5, 4, 3, 2, 1]
    .map((n) => `<input type="radio" id="r${n}" name="rating" value="${n}"><label for="r${n}" aria-label="${n} bintang"><i data-lucide="star"></i></label>`)
    .join('');
  return `${back('#/pesanan')}
  <form class="glass box" data-f="rating" data-id="${o.id}" novalidate>
    <h1>Nilai ${esc(s.toko)}</h1>
    <div class="stars" role="radiogroup" aria-label="Rating">${bintang}</div>
    <label>Komentar singkat<textarea class="in" name="komentar" maxlength="200"></textarea></label>
    <p class="err" id="err"></p>
    <button class="btn y">Kirim Rating</button>
  </form>`;
}

// Login penjual
function vLogin() {
  return `<div class="auth">${authSide}${authTop('login')}
  <form class="glass box" data-f="login" novalidate>
    <h1>Masuk Penjual</h1>
    ${fldi('wa', 'Nomor WhatsApp', 'tel', 'phone', '', 'placeholder="08xxxxxxxxxx" autocomplete="tel" inputmode="tel"')}
    ${fldi('password', 'Password', 'password', 'lock', '', 'placeholder="Password kamu" autocomplete="current-password"')}
    <p class="err" id="err"></p>
    <button class="btn y">Masuk</button>
    <p class="alt">Belum punya akun? <a href="#/daftar"><b>Daftar</b></a></p>
  </form></div>`;
}

// Daftar penjual
function vDaftar() {
  tmp.fotos = [];
  return `<div class="auth wide">${authSide}${authTop('daftar')}
  <form class="glass box fgrid" data-f="daftar" novalidate>
    <h1>Daftar Penjual</h1>
    <h3 class="sec full">Data diri</h3>
    ${fldi('nama', 'Nama', 'text', 'user', '', 'autocomplete="name"')}
    ${fldi('kelas', 'Kelas', 'text', 'graduation-cap', '', 'placeholder="mis. XI TKJ 1"')}
    <h3 class="sec full">Kontak &amp; toko</h3>
    ${fldi('wa', 'Nomor WhatsApp', 'tel', 'phone', '', 'placeholder="08xxxxxxxxxx" inputmode="tel"')}
    ${fldi('toko', 'Nama toko/kelompok', 'text', 'store')}
    <label class="full">Deskripsi singkat<textarea class="in" name="deskripsi"></textarea></label>
    <label class="full">Foto profil/logo (opsional)<input class="in" type="file" accept="image/*" data-file="profil"></label>
    <div class="prevs full" id="prev"></div>
    <h3 class="sec full">Keamanan</h3>
    ${fldi('password', 'Password (min. 6 karakter)', 'password', 'lock', '', 'autocomplete="new-password"')}
    ${fldi('konfirmasi', 'Konfirmasi password', 'password', 'key-round', '', 'autocomplete="new-password"')}
    <p class="err" id="err"></p>
    <button class="btn y">Daftar</button>
    <p class="alt">Sudah punya akun? <a href="#/login"><b>Masuk</b></a></p>
  </form></div>`;
}

// Dashboard penjual (router menolak akses jika belum login)
function vDash() {
  const s = me();
  const produk = Storage.getAll('kk_products').filter((p) => p.sellerId === s.id);
  const pesanan = Storage.getAll('kk_orders').filter((o) => o.sellerId === s.id).reverse();

  const kartuProduk = produk.map((p) => `<div class="glass box row2">${img(p.fotos[0], p.nama, 'th')}<div><b>${esc(p.nama)}</b><br>${rp(p.harga)} · ${p.status === 'ready' ? 'Stok ' + p.stok : 'PO'}</div><button class="ic" data-c="delprod" data-id="${p.id}" aria-label="Hapus ${esc(p.nama)}"><i data-lucide="trash-2"></i></button></div>`).join('');

  const kartuPesanan = pesanan.map((o) => {
    const p = Storage.getById('kk_products', o.productId);
    return `<div class="glass box"><b>${esc(p ? p.nama : 'Produk dihapus')}</b> x${o.jumlah}<p>${esc(o.namaPembeli)} · ${esc(o.kelasPembeli)}</p><b class="price">${rp(o.total)}</b>${o.catatan ? '<small>Catatan: ' + esc(o.catatan) + '</small>' : ''}</div>`;
  }).join('');

  return `<div class="split dash">
    <aside class="side"><div class="glass box c">${img(s.foto, s.toko, 'av big')}<h1>${esc(s.toko)}</h1><small>${esc(s.nama)} · ${esc(s.kelas)}</small>${star(s.id)}<button class="btn o" data-c="logout"><i data-lucide="log-out"></i>Keluar</button></div></aside>
    <div class="main">
      <div class="between"><h2>Produk Saya</h2><a class="btn y sm" href="#/produk-baru"><i data-lucide="plus"></i>Tambah</a></div>
      <div class="cards2">${kartuProduk || '<p class="empty">Belum ada produk.</p>'}</div>
      <h2>Pesanan Masuk</h2>
      <div class="cards2">${kartuPesanan || '<p class="empty">Belum ada pesanan.</p>'}</div>
    </div></div>`;
}

// Form tambah produk + kalkulator harga
function vNew() {
  tmp.fotos = [];
  const pilihKategori = CATS.map((c) => `<option>${c[0]}</option>`).join('');
  const preset = [['Aman', 20], ['Standar', 30], ['Untung Besar', 40]]
    .map(([nama, margin]) => `<button type="button" class="chip" data-c="preset" data-m="${margin}">${nama}<small>${margin}%</small></button>`)
    .join('');
  return `${back('#/dashboard')}
  <form class="glass box fcols" data-f="produk" novalidate>
    <h1>Tambah Produk</h1>
    <div class="fc">
      <label>Foto produk (1-3, JPG/PNG/WebP maks. 5 MB)<input class="in" type="file" accept="image/*" data-file="produk"></label>
      <div class="prevs" id="prev"></div>
      ${fld('nama', 'Nama produk', 'text')}
      <label>Kategori<select class="in" name="kategori">${pilihKategori}</select></label>
      <label>Deskripsi<textarea class="in" name="deskripsi"></textarea></label>
    </div>
    <div class="fc">
      <label>Status<select class="in" name="status" id="st"><option value="ready">READY</option><option value="po">PRE-ORDER</option></select></label>
      <div id="f-ready">${fld('stok', 'Stok', 'number', '1', 'min="1"')}</div>
      <div id="f-po" hidden>${fld('estimasiPO', 'Estimasi tanggal siap', 'date')}</div>
      <div class="calc">
        <h3>Kalkulator Harga</h3>
        ${fld('modal', 'Modal per unit (Rp)', 'number', '', 'min="0"')}
        ${fld('margin', 'Target margin (%)', 'number', '30', 'min="0" max="99"')}
        <div class="row3">${preset}</div>
        ${fld('harga', 'Harga jual (Rp) - boleh diubah manual', 'number')}
        <div id="calc" aria-live="polite"></div>
        <p class="help">Margin = untung dibanding HARGA JUAL. Markup = untung dibanding MODAL. Contoh: modal Rp7.000, jual Rp10.000 -> untung Rp3.000, margin 30%, markup 42,9%.</p>
      </div>
    </div>
    <div class="fb"><p class="err" id="err"></p><button class="btn y">Simpan Produk</button></div>
  </form>`;
}


/* =====================================================================
   12. KALKULATOR HARGA & PREVIEW FOTO
   ===================================================================== */

// Hitung real-time. `sumber` = nama kolom yang baru diubah
// (jika 'harga' = harga diisi manual, jadi harga tidak ditimpa rekomendasi).
function calc(sumber) {
  const ambil = (nama) => parseFloat($(`[name=${nama}]`).value) || 0;
  const modal = ambil('modal');
  const margin = ambil('margin');
  const out = $('#calc');

  if (margin >= 100 || margin < 0) {
    out.innerHTML = '<p class="warn">Margin harus kurang dari 100%</p>';
    return;
  }
  if (sumber !== 'harga' && modal > 0) $('[name=harga]').value = hargaRek(modal, margin);

  const harga = ambil('harga');
  const untung = harga - modal;
  if (!modal) { out.innerHTML = ''; return; }

  out.innerHTML = `<p>Harga rekomendasi: <b>${rp(hargaRek(modal, margin))}</b></p><p>Untung per unit: <b>${rp(untung)}</b></p>
  <p>Margin aktual: <b>${harga ? (untung / harga * 100).toFixed(1) : 0}%</b> · Markup aktual: <b>${(untung / modal * 100).toFixed(1)}%</b></p>
  ${$('#st').value === 'ready' ? `<p>Estimasi untung jika stok habis: <b>${rp(untung * ambil('stok'))}</b></p>` : ''}
  ${harga <= modal ? '<p class="warn">Peringatan: harga jual sama dengan atau di bawah modal (RUGI)!</p>' : ''}`;
}

// Preview foto + tombol hapus per foto
function showPrev() {
  $('#prev').innerHTML = tmp.fotos
    .map((f, i) => `<div class="th"><img src="${f}" alt="Foto ${i + 1}"><button type="button" class="x" data-c="delfoto" data-i="${i}" aria-label="Hapus foto ${i + 1}"><i data-lucide="x"></i></button></div>`)
    .join('');
  lucide.createIcons();
}


/* =====================================================================
   13. AKSI FORM
   Kunci objek = nilai atribut data-f pada <form>.
   ===================================================================== */
const F = {
  // Simpan pesanan, lalu buka WhatsApp penjual
  pesan(form) {
    const p = Storage.getById('kk_products', form.dataset.id);
    const d = Object.fromEntries(new FormData(form));
    const jumlah = parseInt(d.jumlah);

    const galat = !d.nama.trim() || !d.kelas.trim() ? 'Nama dan kelas wajib diisi'
      : !(jumlah >= 1) ? 'Jumlah minimal 1'
      : (p.status === 'ready' && jumlah > p.stok) ? `Jumlah melebihi stok (${p.stok})`
      : '';
    if (galat) return fail(galat);

    const pesanan = Storage.add('kk_orders', {
      productId: p.id,
      sellerId: p.sellerId,
      namaPembeli: d.nama.trim(),
      kelasPembeli: d.kelas.trim(),
      jumlah,
      total: jumlah * p.harga,
      catatan: d.catatan.trim(),
      tanggal: new Date().toISOString(),
      sudahDinilai: false
    });
    if (!pesanan) return;

    // Riwayat pesanan di perangkat ini
    Storage.setObj('kk_my', [...(Storage.getObj('kk_my') || []), pesanan.id]);
    location.hash = '#/pesanan';
    window.open(waLink(pesanan, p, sellerOf(p.sellerId)), '_blank');
  },

  // Beri rating penjual (satu rating per pesanan)
  rating(form) {
    const d = Object.fromEntries(new FormData(form));
    const pesanan = Storage.getById('kk_orders', form.dataset.id);

    if (!d.rating) return fail('Pilih bintang 1-5');
    if (Storage.getAll('kk_reviews').some((r) => r.orderId === pesanan.id)) return fail('Pesanan ini sudah dinilai');

    Storage.add('kk_reviews', {
      sellerId: pesanan.sellerId,
      orderId: pesanan.id,
      rating: +d.rating,
      komentar: (d.komentar || '').trim(),
      namaPembeli: pesanan.namaPembeli,
      tanggal: new Date().toISOString()
    });
    Storage.update('kk_orders', pesanan.id, { sudahDinilai: true });
    toast('Terima kasih atas penilaianmu');
    location.hash = '#/pesanan';
  },

  // Login penjual
  async login(form) {
    const d = Object.fromEntries(new FormData(form));
    const penjual = Storage.getAll('kk_sellers').find((x) => toWA(x.wa) === toWA(d.wa));
    if (!penjual || penjual.passwordHash !== await sha256(d.password)) return fail('Nomor WhatsApp atau password salah');
    Storage.setObj('kk_session', { sellerId: penjual.id });
    location.hash = '#/dashboard';
  },

  // Daftar penjual baru
  async daftar(form) {
    const d = Object.fromEntries(new FormData(form));
    const galat = [d.nama, d.kelas, d.toko, d.deskripsi].some((x) => !x.trim()) ? 'Semua kolom wajib diisi (kecuali foto)'
      : !validWA(d.wa) ? 'Nomor WhatsApp tidak valid (contoh 081234567890)'
      : Storage.getAll('kk_sellers').some((s) => toWA(s.wa) === toWA(d.wa)) ? 'Nomor WhatsApp sudah terdaftar'
      : d.password.length < 6 ? 'Password minimal 6 karakter'
      : d.password !== d.konfirmasi ? 'Konfirmasi password tidak sama'
      : '';
    if (galat) return fail(galat);

    const penjual = Storage.add('kk_sellers', {
      nama: d.nama.trim(),
      kelas: d.kelas.trim(),
      wa: toWA(d.wa),
      toko: d.toko.trim(),
      deskripsi: d.deskripsi.trim(),
      foto: tmp.fotos[0] || '',
      passwordHash: await sha256(d.password),
      dibuat: new Date().toISOString()
    });
    if (penjual) {
      Storage.setObj('kk_session', { sellerId: penjual.id });
      location.hash = '#/dashboard';
    }
  },

  // Simpan produk baru
  produk(form) {
    const d = Object.fromEntries(new FormData(form));
    const modal = +d.modal;
    const harga = +d.harga;

    const galat = !d.nama.trim() ? 'Nama produk wajib diisi'
      : !tmp.fotos.length ? 'Tambahkan minimal 1 foto'
      : !d.deskripsi.trim() ? 'Deskripsi wajib diisi'
      : !(modal > 0) ? 'Isi modal per unit'
      : !(harga > 0) ? 'Isi harga jual'
      : (d.status === 'ready' && !(+d.stok >= 1)) ? 'Stok minimal 1'
      : (d.status === 'po' && !d.estimasiPO) ? 'Isi estimasi tanggal siap'
      : '';
    if (galat) return fail(galat);

    const tersimpan = Storage.add('kk_products', {
      sellerId: me().id,
      nama: d.nama.trim(),
      kategori: d.kategori,
      deskripsi: d.deskripsi.trim(),
      fotos: tmp.fotos,
      modal,
      margin: +((harga - modal) / harga * 100).toFixed(1),
      harga,
      status: d.status,
      stok: d.status === 'ready' ? +d.stok : 0,
      estimasiPO: d.status === 'po' ? d.estimasiPO : ''
    });
    if (tersimpan) {
      toast('Produk tersimpan');
      location.hash = '#/dashboard';
    }
  }
};


/* =====================================================================
   14. EVENT GLOBAL (event delegation: satu listener untuk semua halaman)
   ===================================================================== */

// Submit form -> jalankan F[data-f]
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-f]');
  if (!form) return;
  e.preventDefault();
  F[form.dataset.f](form);
});

// Klik tombol ber-atribut data-c
document.addEventListener('click', (e) => {
  const tombol = e.target.closest('[data-c]');
  if (!tombol) return;
  const aksi = tombol.dataset.c;

  if (aksi === 'kat') { st.kat = tombol.dataset.v; refresh(); }
  if (aksi === 'hero') { heroGo(+tombol.dataset.i); heroStart(); }
  if (aksi === 'preset') { $('[name=margin]').value = tombol.dataset.m; calc(); }
  if (aksi === 'delfoto') { tmp.fotos.splice(+tombol.dataset.i, 1); showPrev(); }
  if (aksi === 'delprod') {
    const p = Storage.getById('kk_products', tombol.dataset.id);
    konfirmasi({
      judul: 'Hapus produk?',
      teks: `"${p ? p.nama : 'Produk ini'}" akan dihapus permanen dan tidak bisa dikembalikan.`,
      ya: 'Hapus',
      batal: 'Batal'
    }).then((ya) => {
      if (ya) {
        Storage.remove('kk_products', tombol.dataset.id);
        toast('Produk dihapus');
        route();
      }
    });
  }
  if (aksi === 'logout') { Storage.delObj('kk_session'); location.hash = '#/'; }
});

// Ketik di kolom: search, kalkulator, status produk
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'q') { st.q = t.value; refresh(); }
  if (['modal', 'margin', 'stok'].includes(t.name)) calc(t.name);
  if (t.name === 'harga') calc('harga');
  if (t.id === 'st') {
    $('#f-ready').hidden = t.value !== 'ready';
    $('#f-po').hidden = t.value !== 'po';
    calc('stok');
  }
});

// Pilih file foto: validasi + kompres + preview
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (!t.dataset.file) return;
  const file = t.files[0];
  t.value = '';
  if (!file) return;

  const fotoProfil = t.dataset.file === 'profil';
  if (!fotoProfil && tmp.fotos.length >= 3) return toast('Maksimal 3 foto');
  try {
    const hasil = await compress(file, fotoProfil ? 300 : 800);
    tmp.fotos = fotoProfil ? [hasil] : [...tmp.fotos, hasil];
    showPrev();
  } catch (pesan) {
    toast(pesan);
  }
});


/* =====================================================================
   15. ANIMASI SAAT SCROLL (fade + slide up)
   ===================================================================== */
const io = new IntersectionObserver((entri) => entri.forEach((x) => {
  if (x.isIntersecting) {
    x.target.classList.add('in');
    io.unobserve(x.target);
  }
}), { threshold: .1 });

const reveal = () => document.querySelectorAll('.rv:not(.in)').forEach((el) => io.observe(el));


/* =====================================================================
   16. ROUTER (hash)
   #/ , #/produk , #/produk/ID , #/penjual/ID , #/pesan/ID , #/pesanan ,
   #/rating/ID , #/login , #/daftar , #/dashboard , #/produk-baru
   ===================================================================== */
function route() {
  const [, a = '', b] = location.hash.slice(1).split('/');

  // Dashboard & tambah produk wajib login
  if (['dashboard', 'produk-baru'].includes(a) && !me()) {
    location.hash = '#/login';
    return;
  }

  const halaman = {
    '': vHome,
    produk: () => (b ? vDetail(b) : vProduk()),
    penjual: () => vSeller(b),
    pesan: () => vPesan(b),
    pesanan: vPesanan,
    rating: () => vRating(b),
    login: vLogin,
    daftar: vDaftar,
    dashboard: vDash,
    'produk-baru': vNew
  };
  $('#view').innerHTML = (halaman[a] || nf)();

  // Penanda halaman aktif (dipakai CSS untuk lebar halaman & sembunyikan navbar di login/daftar)
  const nama = a || 'home';
  $('#view').dataset.p = nama;
  document.body.dataset.p = nama;
  document.documentElement.dataset.p = nama;

  // Menu aktif: 0 Beranda, 1 Produk, 2 Pesanan, 3 Jual
  const k = { '': 0, produk: 1, penjual: 1, pesan: 1, pesanan: 2, rating: 2 }[a] ?? 3;
  document.querySelectorAll('[data-k]').forEach((el) => el.classList.toggle('on', +el.dataset.k === k));

  window.scrollTo(0, 0);
  lucide.createIcons();
  reveal();
  heroI = 0;
  heroStart(); // mulai/hentikan pergantian deskripsi hero sesuai halaman
}

window.addEventListener('hashchange', route);
route();
