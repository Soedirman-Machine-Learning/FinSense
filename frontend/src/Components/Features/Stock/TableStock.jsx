import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../../../hooks/useProducts';

function TableStock({ searchTerm = '' }) {
  const navigate = useNavigate();
  const { products, loading } = useProducts();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filter products berdasarkan searchTerm (nama atau SKU)
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const lowerSearch = searchTerm.toLowerCase();
    return products.filter(
      (product) =>
        product.name?.toLowerCase().includes(lowerSearch) ||
        product.sku?.toLowerCase().includes(lowerSearch),
    );
  }, [products, searchTerm]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredProducts.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalItems = filteredProducts.length;
  const startRange = totalItems === 0 ? 0 : indexOfFirstItem + 1;
  const endRange = Math.min(indexOfLastItem, totalItems);

  const goToNextPage = () => {
    if (indexOfLastItem < totalItems) setCurrentPage(currentPage + 1);
  };
  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  if (loading) return <div className='p-4'>Memuat data stok...</div>;

  return (
    <div className='overflow-x-auto'>
      <div className='min-w-[800px]'>
        <div className='bg-sky-950 p-2 flex w-full mt-4 text-white font-semibold'>
          <div className='flex-1 text-center'>No.</div>
          <div className='flex-4 text-center'>Nama Produk</div>
          <div className='flex-4 text-center'>SKU</div>
          <div className='flex-2 text-center'>Stok</div>
          <div className='flex-4 text-center'>Status</div>
        </div>
        <div className='flex flex-col'>
          {currentItems.length === 0 ? (
            <div className='p-4 text-center text-gray-500'>
              {searchTerm
                ? 'Tidak ada produk yang cocok'
                : 'Tidak ada data stok barang'}
            </div>
          ) : (
            currentItems.map((product, idx) => (
              <div
                key={product.id}
                onClick={() => navigate(`/stocks/${product.id}`)}
                className='flex items-center w-full p-2 border-b border-r border-l border-gray-300 cursor-pointer hover:bg-gray-300 transition-all'
              >
                <div className='flex-1 text-center text-gray-800 text-sm'>
                  {indexOfFirstItem + idx + 1}
                </div>
                <div className='flex-4 text-center text-gray-800 text-sm'>
                  {product.name}
                </div>
                <div className='flex-4 text-center text-gray-800 text-sm'>
                  {product.sku}
                </div>
                <div className='flex-2 text-center text-gray-800 text-sm'>
                  {product.stock}
                </div>
                <div className='flex-4 text-center text-gray-800 text-sm'>
                  <span
                    className={`font-bold ${product.stock <= product.min_stock ? 'text-red-700' : 'text-green-700'}`}
                  >
                    {product.stock <= product.min_stock ? 'Menipis' : 'Aman'}
                  </span>
                </div>
              </div>
            ))
          )}
          <div className='p-2 border-t border-gray-200 flex justify-between'>
            <p className='text-sm text-gray-500'>
              Menampilkan {startRange}-{endRange} dari {totalItems} produk
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

export default TableStock;
