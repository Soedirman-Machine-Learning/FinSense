import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProducts } from '../../../hooks/useProducts';

function EditStock() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, editProduct } = useProducts();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [min_stock, setMinStock] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const product = products.find((p) => p.id === id);
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setUnit(product.unit || '');
      setPrice(product.price || '');
      setMinStock(product.min_stock || 10);
      setLoading(false);
    } else if (products.length > 0) {
      setLoading(false);
    }
  }, [products, id]);

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const data = {
      name,
      sku,
      unit: unit || null,
      price: price ? parseFloat(price) : null,
      min_stock: parseInt(min_stock),
    };
    const result = await editProduct(id, data);
    setSubmitting(false);
    if (result) navigate(`/stocks/${id}`);
  };

  if (loading) return <div className='p-6'>Memuat data...</div>;

  return (
    <form onSubmit={onSubmitHandler}>
      <h1 className='text-2xl font-bold text-gray-800'>Edit Produk</h1>
      <p className='mb-2 mt-2 text-sm text-gray-500'>ID Produk: {id}</p>
      <div className='grid grid-cols-2 gap-2 border-t pt-2'>
        <p className='flex items-center font-semibold text-gray-600'>
          Nama Produk:
        </p>
        <input
          className='p-2 border border-gray-400 rounded'
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <p className='flex items-center font-semibold text-gray-600'>SKU:</p>
        <input
          className='p-2 border border-gray-400 rounded'
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          required
        />
        <p className='flex items-center font-semibold text-gray-600'>Satuan:</p>
        <input
          className='p-2 border border-gray-400 rounded'
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <p className='flex items-center font-semibold text-gray-600'>Harga:</p>
        <input
          type='number'
          className='p-2 border border-gray-400 rounded'
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <p className='flex items-center font-semibold text-gray-600'>
          Minimal Stok:
        </p>
        <input
          type='number'
          className='p-2 border border-gray-400 rounded'
          value={min_stock}
          onChange={(e) => setMinStock(e.target.value)}
        />
      </div>
      <button
        type='submit'
        disabled={submitting}
        className='flex items-center gap-2 mt-4 cursor-pointer bg-sky-950 p-2 text-white font-semibold border rounded-lg hover:bg-white hover:text-sky-950 transition-all'
      >
        {submitting ? 'Menyimpan...' : 'Konfirmasi'}
      </button>
    </form>
  );
}

export default EditStock;
