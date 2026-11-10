import React, { useMemo } from 'react';
import { useStockLogs } from '../../../hooks/useStockLogs';

function StatLog() {
  // Gunakan useMemo agar objek filter tidak dibuat ulang setiap render
  const filters = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    return { startDate: startOfDay, endDate: endOfDay };
  }, []); // dependency kosong → stabil sepanjang lifecycle komponen

  const { logs, loading } = useStockLogs(filters);

  const stats = useMemo(() => {
    let totalTransactions = logs.length;
    let stockIn = logs
      .filter((l) => l.type === 'in')
      .reduce((sum, l) => sum + l.quantity, 0);
    let stockOut = logs
      .filter((l) => l.type === 'out')
      .reduce((sum, l) => sum + l.quantity, 0);
    return { totalTransactions, stockIn, stockOut };
  }, [logs]);

  // if (loading) return <div className='flex w-full gap-4 mt-4'>Memuat statistik...</div>;

  return (
    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4'>
      <div className='relative flex-1 flex flex-col justify-between bg-white p-4 border rounded-md border-gray-300 shadow-sm'>
        <h1 className='text-gray-500 font-bold text-sm uppercase tracking-wider'>
          TOTAL TRANSAKSI HARI INI
        </h1>
        <p className='flex items-center gap-2 text-2xl font-bold text-sky-950'>
          <span>{stats.totalTransactions}</span>
          <span className='relative text-sm top-1'>Transaksi</span>
        </p>
      </div>
      <div className='relative flex-1 flex flex-col justify-between bg-white p-4 border rounded-md border-gray-300 shadow-sm'>
        <h1 className='text-gray-500 font-bold text-sm uppercase tracking-wider'>
          STOK MASUK HARI INI
        </h1>
        <p className='flex items-center gap-2 text-2xl font-bold text-sky-950'>
          <span>{stats.stockIn}</span>
          <span className='relative text-sm top-1'>Barang</span>
        </p>
      </div>
      <div className='relative flex-1 flex flex-col justify-between bg-white p-4 border rounded-md border-gray-300 shadow-sm'>
        <h1 className='text-gray-500 font-bold text-sm uppercase tracking-wider'>
          STOK KELUAR HARI INI
        </h1>
        <p className='flex items-center gap-2 text-2xl font-bold text-sky-950'>
          <span>{stats.stockOut}</span>
          <span className='relative text-sm top-1'>Barang</span>
        </p>
      </div>
    </div>
  );
}

export default StatLog;
