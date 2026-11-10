import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebts } from '../../../hooks/useDebts';

function TableDebt({ searchTerm = '' }) {
  const navigate = useNavigate();
  const { debts, loading } = useDebts();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter debts berdasarkan searchTerm
  const filteredDebts = useMemo(() => {
    if (!searchTerm.trim()) return debts;
    const lowerSearch = searchTerm.toLowerCase();
    return debts.filter((debt) =>
      debt.customer_name?.toLowerCase().includes(lowerSearch),
    );
  }, [debts, searchTerm]);

  const totalItems = filteredDebts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredDebts.slice(indexOfFirstItem, indexOfLastItem);
  const startRange = totalItems === 0 ? 0 : indexOfFirstItem + 1;
  const endRange = Math.min(indexOfLastItem, totalItems);

  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  // Helper untuk badge status
  const getStatusBadge = (status) => {
    const statusMap = {
      pending: {
        label: 'Belum Lunas',
        className: 'bg-yellow-100 text-yellow-800',
      },
      partial: {
        label: 'Sebagian Lunas',
        className: 'bg-blue-100 text-blue-800',
      },
      paid: { label: 'Lunas', className: 'bg-green-100 text-green-800' },
      overdue: { label: 'Jatuh Tempo', className: 'bg-red-100 text-red-800' },
    };
    const statusInfo = statusMap[status] || {
      label: status,
      className: 'bg-gray-100 text-gray-800',
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.className}`}
      >
        {statusInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className='p-4 text-center text-gray-500'>
        Memuat daftar hutang...
      </div>
    );
  }

  if (filteredDebts.length === 0) {
    return (
      <div className='p-4 text-center text-gray-500'>
        {searchTerm ? 'Tidak ada hutang yang cocok' : 'Belum ada data hutang'}
      </div>
    );
  }

  return (
    <div className='overflow-x-auto shadow-md rounded-lg'>
      <table className='min-w-full bg-white border border-gray-200'>
        <thead className='bg-sky-950 text-white'>
          <tr>
            <th className='px-4 py-3 text-center text-sm font-semibold'>No</th>
            <th className='px-4 py-3 text-left text-sm font-semibold'>
              Nama Pelanggan
            </th>
            <th className='px-4 py-3 text-right text-sm font-semibold'>
              Total Hutang
            </th>
            <th className='px-4 py-3 text-right text-sm font-semibold'>
              Sudah Dibayar
            </th>
            <th className='px-4 py-3 text-right text-sm font-semibold'>
              Sisa Hutang
            </th>
            <th className='px-4 py-3 text-center text-sm font-semibold'>
              Jatuh Tempo
            </th>
            <th className='px-4 py-3 text-center text-sm font-semibold'>
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {currentItems.map((debt, idx) => {
            const remaining = debt.total_debt - debt.paid_amount;
            return (
              <tr
                key={debt.id}
                onClick={() => navigate(`/debts/${debt.id}`)}
                className='border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-all'
              >
                <td className='px-4 py-3 text-center text-sm text-gray-700'>
                  {indexOfFirstItem + idx + 1}
                </td>
                <td className='px-4 py-3 text-left text-sm font-medium text-gray-900'>
                  {debt.customer_name}
                </td>
                <td className='px-4 py-3 text-right text-sm text-gray-500 line-through'>
                  Rp {debt.total_debt?.toLocaleString('id-ID')}
                </td>
                <td className='px-4 py-3 text-right text-sm text-gray-600'>
                  Rp {debt.paid_amount?.toLocaleString('id-ID')}
                </td>
                <td className='px-4 py-3 text-right text-sm font-bold text-red-700'>
                  Rp {remaining?.toLocaleString('id-ID')}
                </td>
                <td className='px-4 py-3 text-center text-sm text-gray-700'>
                  {new Date(debt.due_date).toLocaleDateString('id-ID')}
                </td>
                <td className='px-4 py-3 text-center'>
                  {getStatusBadge(debt.status)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center'>
          <p className='text-sm text-gray-500'>
            Menampilkan {startRange}-{endRange} dari {totalItems} hutang
          </p>
          <div className='flex gap-2 items-center'>
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 1}
              className={`px-3 py-1 text-sm border rounded-md font-medium transition-all ${
                currentPage === 1
                  ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                  : 'text-gray-600 border-gray-300 hover:bg-white cursor-pointer'
              }`}
            >
              Sebelumnya
            </button>
            <span className='px-3 py-1 text-sm text-gray-700'>
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 text-sm border rounded-md font-medium transition-all ${
                currentPage === totalPages
                  ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                  : 'text-gray-600 border-gray-300 hover:bg-white cursor-pointer'
              }`}
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TableDebt;
