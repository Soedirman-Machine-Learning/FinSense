import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransactions } from '../../../hooks/useTransactions';

function TableTransaction({ startDate = '', endDate = '' }) {
  const navigate = useNavigate();
  const { transactions, loading } = useTransactions();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filter transaksi berdasarkan rentang tanggal
  const filteredTransactions = useMemo(() => {
    if (!startDate && !endDate) return transactions;

    return transactions.filter((transaction) => {
      const txDate = transaction.transaction_date.split('T')[0]; // ambil YYYY-MM-DD
      if (startDate && endDate) {
        return txDate >= startDate && txDate <= endDate;
      } else if (startDate) {
        return txDate >= startDate;
      } else if (endDate) {
        return txDate <= endDate;
      }
      return true;
    });
  }, [transactions, startDate, endDate]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTransactions.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalItems = filteredTransactions.length;
  const startRange = totalItems === 0 ? 0 : indexOfFirstItem + 1;
  const endRange = Math.min(indexOfLastItem, totalItems);

  const goToNextPage = () => {
    if (indexOfLastItem < totalItems) setCurrentPage(currentPage + 1);
  };
  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  if (loading) return <div className='p-4'>Memuat transaksi...</div>;

  return (
    <div className='overflow-x-auto'>
      <div className='min-w-[800px]'>
        <div className='bg-sky-950 p-2 flex w-full mt-4 text-white font-semibold'>
          <div className='flex-1 text-center'>No.</div>
          <div className='flex-4 text-center'>Tanggal</div>
          <div className='flex-4 text-center'>Kategori</div>
          <div className='flex-4 text-center'>Keterangan</div>
          <div className='flex-4 text-center'>Nominal</div>
          <div className='flex-4 text-center'>Tipe</div>
        </div>
        <div className='flex flex-col'>
          {totalItems === 0 ? (
            <div className='p-8 text-center text-gray-500 border-b border-r border-gray-300'>
              {startDate || endDate
                ? 'Tidak ada transaksi dalam rentang tanggal tersebut'
                : 'Belum ada catatan transaksi.'}
            </div>
          ) : (
            currentItems.map((transaction, idx) => (
              <div
                key={transaction.id}
                onClick={() => navigate(`/transactions/${transaction.id}`)}
                className='flex items-center w-full p-2 border-b border-r border-l border-gray-300 cursor-pointer hover:bg-gray-300 transition-all'
              >
                <div className='flex-1 text-center text-gray-800 text-sm'>
                  {indexOfFirstItem + idx + 1}
                </div>
                <div className='flex-4 text-center text-gray-800 text-sm'>
                  {new Date(transaction.transaction_date).toLocaleDateString(
                    'id-ID',
                  )}
                </div>
                <div className='flex-4 text-center text-gray-800 text-sm'>
                  {transaction.category?.name || '-'}
                </div>
                <div className='flex-4 text-center text-gray-800 text-sm'>
                  {transaction.description || '-'}
                </div>
                <div className='flex-4 text-center text-gray-800 text-sm'>
                  Rp {transaction.amount?.toLocaleString()}
                </div>
                <div className='flex-4 text-center text-gray-800 text-sm'>
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                      transaction.type === 'income'
                        ? 'text-green-700'
                        : 'text-red-700'
                    }`}
                  >
                    {transaction.type === 'income' ? 'Masuk' : 'Keluar'}
                  </span>
                </div>
              </div>
            ))
          )}
          <div className='p-2 border-t border-gray-200 flex justify-between'>
            <p className='text-sm text-gray-500'>
              Menampilkan {startRange}-{endRange} dari {totalItems} transaksi
            </p>
            <div className='flex gap-2'>
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className={`px-3 py-1 text-sm border rounded-md font-medium ${
                  currentPage === 1
                    ? 'text-gray-300 border-gray-200'
                    : 'cursor-pointer text-gray-600 border-gray-300 hover:bg-white'
                }`}
              >
                Sebelumnya
              </button>
              <button
                onClick={goToNextPage}
                disabled={indexOfLastItem >= totalItems}
                className={`px-3 py-1 text-sm border rounded-md font-medium ${
                  indexOfLastItem >= totalItems
                    ? 'text-gray-300 border-gray-200'
                    : 'cursor-pointer text-gray-600 border-gray-300 hover:bg-white'
                }`}
              >
                Selanjutnya
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TableTransaction;
