import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockLogs } from '../../../hooks/useStockLogs';

function TableLog({ searchTerm = '' }) {
  const navigate = useNavigate();
  const { logs, loading } = useStockLogs();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter logs berdasarkan searchTerm (nama produk atau SKU)
  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const lowerSearch = searchTerm.toLowerCase();
    return logs.filter(
      (log) =>
        log.product?.name?.toLowerCase().includes(lowerSearch) ||
        log.product?.sku?.toLowerCase().includes(lowerSearch),
    );
  }, [logs, searchTerm]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);
  const totalItems = filteredLogs.length;
  const startRange = totalItems === 0 ? 0 : indexOfFirstItem + 1;
  const endRange = Math.min(indexOfLastItem, totalItems);

  const goToNextPage = () => {
    if (indexOfLastItem < totalItems) setCurrentPage(currentPage + 1);
  };
  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  if (loading) return <div className='p-4'>Memuat data log...</div>;

  return (
    <div className='overflow-x-auto'>
      <div className='min-w-[800px]'>
        <div className='bg-sky-950 p-2 flex w-full mt-4 text-white font-semibold'>
          <div className='flex-1 text-center'>Waktu</div>
          <div className='flex-1 text-center'>Produk</div>
          <div className='flex-1 text-center'>SKU</div>
          <div className='flex-1 text-center'>Tipe</div>
          <div className='flex-1 text-center'>Jumlah</div>
          <div className='flex-1 text-center'>Oleh</div>
          <div className='flex-1 text-center'>Status</div>
        </div>
        <div className='flex flex-col'>
          {currentItems.length === 0 ? (
            <div className='p-4 text-center text-gray-500'>
              {searchTerm
                ? 'Tidak ada log yang cocok'
                : 'Tidak ada data log barang'}
            </div>
          ) : (
            currentItems.map((log) => (
              <div
                key={log.id}
                onClick={() => navigate(`/logs/${log.id}`)}
                className='flex items-center w-full p-2 border-b border-r border-l border-gray-300 cursor-pointer hover:bg-gray-300 transition-all'
              >
                <div className='flex-1 text-center text-gray-800 text-sm'>
                  {new Date(log.created_at).toLocaleString()}
                </div>
                <div className='flex-1 text-center text-gray-800 text-sm font-bold'>
                  {log.product?.name}
                </div>
                <div className='flex-1 text-center text-gray-500 text-sm'>
                  {log.product?.sku}
                </div>
                <div className='flex-1 text-center text-gray-500 text-sm'>
                  {log.type === 'in'
                    ? 'Stok Masuk'
                    : log.type === 'out'
                      ? 'Stok Keluar'
                      : 'Penyesuaian'}
                </div>
                <div className='flex-1 text-center text-gray-800 text-sm'>
                  {log.quantity}
                </div>
                <div className='flex-1 text-center text-gray-800 text-sm'>
                  {log.operator}
                </div>
                <div className='flex-1 text-center text-gray-800 text-sm'>
                  {log.status === 'completed' ? 'Selesai' : 'Menunggu audit'}
                </div>
              </div>
            ))
          )}
          <div className='p-2 border-t border-gray-200 flex justify-between'>
            <p className='text-sm text-gray-500'>
              Menampilkan {startRange}-{endRange} dari {totalItems} log
            </p>
            <div className='flex gap-2'>
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className={`px-3 py-1 text-sm border rounded-md font-medium ${currentPage === 1 ? 'text-gray-300 border-gray-200' : 'cursor-pointer text-gray-600 border-gray-300 hover:bg-white'}`}
              >
                Sebelumnya
              </button>
              <button
                onClick={goToNextPage}
                disabled={indexOfLastItem >= totalItems}
                className={`px-3 py-1 text-sm border rounded-md font-medium ${indexOfLastItem >= totalItems ? 'text-gray-300 border-gray-200' : 'cursor-pointer text-gray-600 border-gray-300 hover:bg-white'}`}
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

export default TableLog;
