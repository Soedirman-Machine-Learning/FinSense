import React from 'react';
import { useDebts } from '../../../hooks/useDebts';

function StatDebt() {
  const { debts, loading } = useDebts();

  // Hitung total sisa hutang (total_debt - paid_amount) untuk status belum lunas
  const total = debts
    .filter(
      (item) =>
        item.status === 'pending' ||
        item.status === 'overdue' ||
        item.status === 'partial',
    )
    .reduce(
      (acc, item) => acc + (item.total_debt - (item.paid_amount || 0)),
      0,
    );

  if (loading) return <div className='p-4'>Memuat total hutang...</div>;

  return (
    <div className='grid grid-cols-1 sm:grid-cols-1 gap-4'>
      <div className='flex w-full sm:w-1/4 flex-col justify-between bg-white p-4 border rounded-md border-gray-300 shadow-sm'>
        <p className='text-md text-gray-500 font-semibold mb-2'>
          TOTAL PIUTANG AKTIF
        </p>
        <p className='text-sky-950 font-bold text-2xl'>
          Rp. {total.toLocaleString('id-ID')}
        </p>
      </div>
    </div>
  );
}

export default StatDebt;
