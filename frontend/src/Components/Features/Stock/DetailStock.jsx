import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProducts } from '../../../hooks/useProducts';
import Swal from 'sweetalert2';

function DetailStock() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, removeProduct, adjustStock } = useProducts();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const found = products.find((p) => p.id === id);
    if (found) {
      setProduct(found);
      setLoading(false);
    } else if (products.length > 0) {
      setLoading(false);
    }
  }, [products, id]);

  const onDeleteHandler = async () => {
    const result = await Swal.fire({
      title: 'Hapus Produk?',
      text: `Yakin ingin menghapus "${product?.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#7f1d1d',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });
    if (result.isConfirmed) {
      const success = await removeProduct(id);
      if (success) navigate('/stocks');
    }
  };

  const onAdjustStock = async (type) => {
    const { value: quantity } = await Swal.fire({
      title: `${type === 'in' ? 'Tambah Stok' : 'Kurangi Stok'}`,
      input: 'number',
      inputLabel: 'Jumlah',
      inputPlaceholder: 'Masukkan jumlah',
      showCancelButton: true,
    });
    if (quantity && quantity > 0) {
      await adjustStock(id, quantity, type);
    }
  };

  if (loading) return <div className='p-6'>Memuat detail...</div>;
  if (!product) return <div className='p-6'>Produk tidak ditemukan</div>;

  return (
    <div>
      <h1 className='text-2xl font-bold text-gray-800'>Detail Produk</h1>
      <p className='mb-2 mt-2 text-sm text-gray-500'>ID Produk: {product.id}</p>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-2 border-t pt-4 mt-2'>
        <p className='font-semibold text-gray-600'>Nama Produk:</p>
        <p>{product.name}</p>
        <p className='font-semibold text-gray-600'>SKU:</p>
        <p>{product.sku}</p>
        <p className='font-semibold text-gray-600'>Jumlah Stok:</p>
        <p>
          {product.stock} {product.unit || ''}
        </p>
        <p className='font-semibold text-gray-600'>Minimal Stok:</p>
        <p>{product.min_stock}</p>
        <p className='font-semibold text-gray-600'>Status:</p>
        <span
          className={`font-bold ${product.stock <= product.min_stock ? 'text-red-600' : 'text-green-600'}`}
        >
          {product.stock <= product.min_stock ? 'Menipis' : 'Aman'}
        </span>
      </div>
      <div className='flex gap-4 mt-4'>
        <button
          onClick={() => navigate(`/stocks/edit/${id}`)}
          className='flex items-center gap-2 cursor-pointer bg-sky-950 p-2 text-white font-semibold border rounded-lg hover:bg-white hover:text-sky-950 transition-all'
        >
          Edit
        </button>
        <button
          onClick={() => onAdjustStock('in')}
          className='flex items-center gap-2 cursor-pointer bg-green-700 p-2 text-white font-semibold border rounded-lg hover:bg-white hover:text-green-700 transition-all'
        >
          Tambah Stok
        </button>
        <button
          onClick={() => onAdjustStock('out')}
          className='flex items-center gap-2 cursor-pointer bg-yellow-600 p-2 text-white font-semibold border rounded-lg hover:bg-white hover:text-yellow-600 transition-all'
        >
          Kurangi Stok
        </button>
        <button
          onClick={onDeleteHandler}
          className='flex items-center gap-2 cursor-pointer bg-red-900 p-2 text-white font-semibold border rounded-lg hover:bg-white hover:text-red-900 transition-all'
        >
          Hapus
        </button>
      </div>
    </div>
  );
}

export default DetailStock;
