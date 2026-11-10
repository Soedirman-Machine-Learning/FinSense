import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockLogs } from '../../../hooks/useStockLogs';
import { getProducts } from '../../../services/productService';
import Swal from 'sweetalert2';

function NewLog() {
  const navigate = useNavigate();
  const { addLog } = useStockLogs();
  const [products, setProducts] = useState([]);
  const [product_id, setProductId] = useState('');
  const [type, setType] = useState('in');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [operator, setOperator] = useState('Admin');
  const [status, setStatus] = useState('completed');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await getProducts();
        setProducts(res.data);
      } catch (err) {
        Swal.fire('Error', 'Gagal memuat daftar produk', 'error');
      }
    };
    fetchProducts();
  }, []);

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    if (!product_id || !quantity) {
      Swal.fire('Perhatian', 'Pilih produk dan isi jumlah', 'info');
      return;
    }
    setSubmitting(true);
    const logData = {
      product_id,
      type,
      quantity: parseInt(quantity),
      note: note || null,
      operator,
      status,
    };
    const result = await addLog(logData);
    setSubmitting(false);
    if (result) navigate('/logs');
  };

  return (
    <form className='py-2 px-4 max-w-2xl' onSubmit={onSubmitHandler}>
      <h1 className='p-2 text-gray-700 text-2xl font-bold'>
        Tambah Log Barang
      </h1>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Produk:</span>
        <select
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={product_id}
          onChange={(e) => setProductId(e.target.value)}
          required
        >
          <option value=''>Pilih produk</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (SKU: {p.sku})
            </option>
          ))}
        </select>
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Tipe:</span>
        <select
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value='in'>Stok Masuk</option>
          <option value='out'>Stok Keluar</option>
          <option value='adjust'>Penyesuaian Manual</option>
        </select>
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Jumlah:</span>
        <input
          type='number'
          placeholder='Masukan jumlah barang...'
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Catatan (opsional):</span>
        <input
          type='text'
          placeholder='Masukan catatan barang...'
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Oleh:</span>
        <select
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
        >
          <option>Admin</option>
          <option>Kasir</option>
          <option>Gudang</option>
        </select>
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Status:</span>
        <select
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value='completed'>Selesai</option>
          <option value='pending_audit'>Menunggu audit</option>
        </select>
      </div>
      <button
        type='submit'
        disabled={submitting}
        className='flex items-center py-2 px-4 mx-2 mt-4 gap-2 cursor-pointer bg-sky-950 text-white font-semibold border rounded-lg hover:bg-white hover:text-sky-950 transition-all'
      >
        {submitting ? 'Menyimpan...' : 'Konfirmasi'}
      </button>
    </form>
  );
}

export default NewLog;
