import React, { useEffect, useState } from 'react';
import api from '../../../services/api';

const LakuDashboard = () => {
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTop = async () => {
      try {
        setLoading(true);
        const res = await api.get('/ai/real-top-products');
        // Pastikan res.data.top_products ada dan berupa array
        const products = Array.isArray(res.data?.top_products)
          ? res.data.top_products
          : [];
        setTopProducts(products);
      } catch (err) {
        console.error(err);
        setTopProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTop();
  }, []);

  // Fungsi untuk menampilkan konten berdasarkan status
  const renderContent = () => {
    if (loading) {
      return (
        <div className='text-center py-4 text-gray-500'>
          Memuat data prediksi...
        </div>
      );
    }

    if (topProducts.length === 0) {
      return (
        <div className='text-center py-4 text-gray-400'>
          Belum ada data produk terlaris hari ini.
        </div>
      );
    }

    return (
      <ul>
        {topProducts.map((p) => (
          <li
            key={p.product}
            className='flex justify-between py-1 border-b border-gray-300'
          >
            <span>{p.product}</span>
            <span
              className={
                p.is_top_seller ? 'text-green-600 font-bold' : 'text-gray-400'
              }
            >
              {p.is_top_seller ? '✅ Top' : '❌'} (
              {Math.round(p.probability * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className='w-full bg-white p-4 border border-gray-300 rounded shadow-sm'>
      <h2 className='flex flex-row gap-1 font-bold text-lg mb-2'>
        <span>
          Prediksi Produk Terlaris Hari Ini
        </span>
        <span className='flex font-semibold items-start text-green-500 text-xs'>
          AI Powered
        </span>
      </h2>
      {renderContent()}
    </div>
  );
};

export default LakuDashboard;
