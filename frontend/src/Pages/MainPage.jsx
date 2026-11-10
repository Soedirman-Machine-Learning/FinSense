import React from 'react';
import { useNavigate } from 'react-router-dom';

import logo from '../../images/logo.png';
import hero from '../../images/herosection.png';
import dashboard from '../../images/dashboard.png';
import stock from '../../images/stock.png';
import cashier from '../../images/cashier.png';
import debt from '../../images/debt.png';
import log from '../../images/log.png';
import aicashier from '../../images/aicashier.png';
import chat from '../../images/chat.png';

function MainPage() {
  const navigate = useNavigate();

  const login = () => navigate('/login');
  const register = () => navigate('/register');

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className='bg-gray-200'>
      {/* Navbar - Responsive */}
      <nav className='sticky top-0 z-50 bg-sky-950 text-white shadow-lg'>
        <div className='container mx-auto px-2 sm:px-4 lg:px-6'>
          <div className='flex items-center justify-between h-16 md:h-20'>
            {/* Logo */}
            <div className='flex items-center gap-2 font-bold text-2xl md:text-3xl'>
              <img src={logo} alt='logo' className='h-8 md:h-10 w-auto' />
              <h1>
                Fin<span className='text-orange-300'>Sense</span>
              </h1>
            </div>

            {/* Menu Desktop */}
            <div className='hidden md:flex items-center space-x-6 lg:space-x-8 text-base lg:text-lg font-medium'>
              <button
                onClick={() => scrollToSection('produk')}
                className='hover:scale-105 transition-transform'
              >
                Produk
              </button>
              <button
                onClick={() => scrollToSection('fitur')}
                className='hover:scale-105 transition-transform'
              >
                Fitur
              </button>
              <button
                onClick={() => scrollToSection('wawasan')}
                className='hover:scale-105 transition-transform'
              >
                Wawasan AI
              </button>
            </div>

            {/* Tombol Auth */}
            <div className='flex items-center space-x-2 sm:space-x-4 text-base md:text-lg font-semibold'>
              <button
                onClick={login}
                className='px-3 py-1 md:px-4 hover:scale-105 transition-transform'
              >
                Masuk
              </button>
              <button
                onClick={register}
                className='px-3 py-1 md:px-4 bg-white text-sky-950 rounded-lg hover:scale-105 transition-transform shadow'
              >
                Daftar
              </button>
            </div>
          </div>

          {/* Menu Mobile (baris terpisah) */}
          <div className='md:hidden flex justify-center gap-4 py-2 text-sm border-t border-sky-800'>
            <button
              onClick={() => scrollToSection('produk')}
              className='hover:underline'
            >
              Produk
            </button>
            <button
              onClick={() => scrollToSection('fitur')}
              className='hover:underline'
            >
              Fitur
            </button>
            <button
              onClick={() => scrollToSection('wawasan')}
              className='hover:underline'
            >
              Wawasan AI
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        id='produk'
        className='bg-gray-200 py-12 md:py-16 lg:py-20 px-4 sm:px-6 lg:px-8'
      >
        <div className='container mx-auto flex flex-col-reverse md:flex-row items-center gap-8 md:gap-12'>
          <div className='flex-1 text-center md:text-left'>
            <h1 className='text-3xl sm:text-4xl lg:text-5xl font-bold text-sky-950 leading-tight'>
              Cerdas untuk Pertumbuhan UMKM Anda
            </h1>
            <p className='mt-4 text-base sm:text-lg text-gray-800 font-medium'>
              Kendalikan bisnis ritel Anda dengan wawasan berbasis AI, manajemen
              inventaris yang mulus, dan pelacakan keuangan otomatis dalam satu
              platform cerdas.
            </p>
            <button
              onClick={register}
              className='mt-6 bg-sky-950 text-white font-bold py-2 px-6 rounded-lg hover:scale-105 transition-transform shadow-md'
            >
              Mulai Sekarang
            </button>
          </div>
          <div className='flex-1 flex justify-center'>
            <img
              src={hero}
              alt='Hero'
              className='w-full max-w-md rounded-xl shadow-2xl'
            />
          </div>
        </div>
      </section>

      {/* Features Grid - Responsif */}
      <section
        id='fitur'
        className='bg-gray-200 py-12 md:py-16 px-4 sm:px-6 lg:px-8 bg-sky-950'
      >
        <div className='container mx-auto'>
          <h2 className='text-3xl font-bold text-center text-white mb-10'>
            Fitur Unggulan
          </h2>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6'>
            {/* Card 1 */}
            <div className='bg-white rounded-xl shadow-lg p-6 flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300'>
              <h3 className='font-bold text-sky-950 text-xl mb-3'>
                Dasbor Utama
              </h3>
              <img
                src={dashboard}
                alt='Dashboard'
                className='h-32 w-full object-contain mb-4'
              />
              <hr className='w-full border-gray-200 mb-4' />
              <p className='text-gray-700 text-sm'>
                Pantau kesehatan bisnis Anda secara instan. Monitor total
                penjualan, tren pendapatan, dan metrik operasional harian.
              </p>
            </div>
            {/* Card 2 */}
            <div className='bg-white rounded-xl shadow-lg p-6 flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300'>
              <h3 className='font-bold text-sky-950 text-xl mb-3'>
                Stok Barang
              </h3>
              <img
                src={stock}
                alt='Stock'
                className='h-32 w-full object-contain mb-4'
              />
              <hr className='w-full border-gray-200 mb-4' />
              <p className='text-gray-700 text-sm'>
                Pantau level inventaris secara real-time, dapatkan peringatan
                stok rendah, dan kelola rantai pasok dengan mudah.
              </p>
            </div>
            {/* Card 3 */}
            <div className='bg-white rounded-xl shadow-lg p-6 flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300'>
              <h3 className='font-bold text-sky-950 text-xl mb-3'>
                Kasir Otomatis
              </h3>
              <img
                src={cashier}
                alt='Cashier'
                className='h-32 w-full object-contain mb-4'
              />
              <hr className='w-full border-gray-200 mb-4' />
              <p className='text-gray-700 text-sm'>
                Percepat proses pembayaran dengan sistem kasir pintar. Proses
                transaksi akurat dan layani pelanggan lebih cepat.
              </p>
            </div>
            {/* Card 4 */}
            <div className='bg-white rounded-xl shadow-lg p-6 flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300'>
              <h3 className='font-bold text-sky-950 text-xl mb-3'>
                Pantau Hutang
              </h3>
              <img
                src={debt}
                alt='Debt'
                className='h-32 w-full object-contain mb-4'
              />
              <hr className='w-full border-gray-200 mb-4' />
              <p className='text-gray-700 text-sm'>
                Kendalikan arus kas Anda sepenuhnya. Lacak faktur yang belum
                dibayar secara otomatis.
              </p>
            </div>
            {/* Card 5 */}
            <div className='bg-white rounded-xl shadow-lg p-6 flex flex-col items-center text-center hover:-translate-y-1 transition-transform duration-300'>
              <h3 className='font-bold text-sky-950 text-xl mb-3'>
                Log Inventaris
              </h3>
              <img
                src={log}
                alt='Log'
                className='h-32 w-full object-contain mb-4'
              />
              <hr className='w-full border-gray-200 mb-4' />
              <p className='text-gray-700 text-sm'>
                Lacak setiap barang yang masuk dan keluar dengan catatan
                historis mendetail untuk audit yang akurat.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Insights */}
      <section
        id='wawasan'
        className='bg-gray-200 py-12 md:py-16 px-4 sm:px-6 lg:px-8'
      >
        <div className='container mx-auto'>
          {/* Insight 1 - Desktop row, mobile column */}
          <div className='flex flex-col md:flex-row items-center gap-8 md:gap-12 mb-16'>
            <div className='flex-1 text-center md:text-left'>
              <h2 className='text-3xl lg:text-4xl font-bold text-sky-950'>
                Operasional Lebih Cerdas <br />
                menggunakan Dukungan AI Suara
              </h2>
              <p className='mt-4 text-gray-800 font-medium text-base lg:text-lg'>
                Percepat alur kerja Anda dengan Kasir Pengenal Suara tanpa
                sentuhan. Cukup bicara pada terminal Anda untuk menambah barang,
                cek harga, atau cetak struk seketika. Serasa memiliki asisten
                tambahan di meja kasir.
              </p>
            </div>
            <div className='flex-1 flex justify-end'>
              <img
                src={aicashier}
                alt='AI Cashier'
                className='w-full max-w-md rounded-2xl shadow-2xl border-4 border-white'
              />
            </div>
          </div>

          {/* Insight 2 - reverse on desktop, tetap urut di mobile */}
          <div className='flex flex-col md:flex-row-reverse items-center gap-8 md:gap-12'>
            <div className='flex-1 text-center md:text-left'>
              <h2 className='text-3xl lg:text-4xl font-bold text-sky-950'>
                Dapatkan Wawasan dari AI 24/7
              </h2>
              <p className='mt-4 text-gray-800 font-medium text-base lg:text-lg'>
                Jangan pernah merasa bingung dengan data Anda lagi. Dukungan AI
                Live kami terintegrasi langsung ke dasbor Anda, siap menjawab
                pertanyaan bisnis yang kompleks, memberikan solusi masalah
                secara real-time, dan saran strategis kapan pun Anda butuhkan.
              </p>
            </div>
            <div className='flex-1 flex justify-start'>
              <img
                src={chat}
                alt='AI Chat'
                className='w-full max-w-md rounded-2xl shadow-2xl border-4 border-white'
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className='bg-sky-950 text-white py-6'>
        <div className='container mx-auto text-center font-bold text-sm md:text-base'>
          <p>FinSense &copy; {new Date().getFullYear()} - Coding Camp 2026</p>
        </div>
      </footer>
    </div>
  );
}

export default MainPage;
