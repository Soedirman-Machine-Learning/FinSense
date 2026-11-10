import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../../../hooks/useProducts';
import Swal from 'sweetalert2';

/* eslint-disable camelcase */

function NewStock() {
  const navigate = useNavigate();
  const { addProduct } = useProducts();
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [min_stock, setMinStock] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    if (!name || !sku) {
      Swal.fire({
        title: 'Mohon isi seluruh data',
        icon: 'info',
      });
      return;
    }
    setSubmitting(true);
    const productData = {
      name,
      sku,
      stock: stock ? parseInt(stock) : 0,
      unit: unit || null,
      price: price ? parseFloat(price) : null,
      min_stock: min_stock ? parseInt(min_stock) : 10,
    };
    const result = await addProduct(productData);
    setSubmitting(false);
    if (result) navigate('/stocks');
  };

  return (
    <form className='py-2 px-4 max-w-2xl' onSubmit={onSubmitHandler}>
      <h1 className='p-2 text-gray-700 text-2xl font-bold'>Tambah Stok Baru</h1>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Nama Barang:</span>
        <input
          type='text'
          placeholder='Masukan nama barang...'
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>SKU Barang:</span>
        <input
          type='text'
          placeholder='Masukan SKU...'
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          required
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Jumlah Stok:</span>
        <input
          type='number'
          placeholder='Masukan jumlah barang...'
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Satuan (opsional):</span>
        <input
          type='text'
          placeholder='Masukan satuan barang...'
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Harga (opsional):</span>
        <input
          type='number'
          placeholder='Masukan harga barang...'
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Minimal Stok (default 10):</span>
        <input
          type='number'
          placeholder='Masukan jumlah minimal barang...'
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={min_stock}
          onChange={(e) => setMinStock(e.target.value)}
        />
      </div>
      <button
        type='submit'
        disabled={submitting}
        className='flex items-center py-2 px-4 mx-2 mt-4 gap-2 cursor-pointer bg-sky-950 text-white font-semibold border rounded-lg hover:bg-white hover:text-sky-950 transition-all'
      >
        {submitting ? 'Menyimpan...' : 'Tambah Barang'}
      </button>
    </form>
  );
}

export default NewStock;
