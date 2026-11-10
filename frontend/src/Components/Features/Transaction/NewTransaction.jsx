import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransactions } from '../../../hooks/useTransactions';
import Swal from 'sweetalert2';

function NewTransaction() {
  const navigate = useNavigate();
  const { addTransaction } = useTransactions();
  const [date, setDate] = useState('');
  const [category_id, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('income');
  const [submitting, setSubmitting] = useState(false);
  const [categories] = useState([
    { id: 1, name: 'Penjualan' },
    { id: 2, name: 'Restok' },
    { id: 3, name: 'Operasional' },
    { id: 4, name: 'Gaji Karyawan' },
    { id: 5, name: 'Bayar Hutang' },
    { id: 6, name: 'Hutang Pelanggan' },
  ]);

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    if (!category_id || !amount) {
      Swal.fire('Perhatian', 'Lengkapi data kategori dan nominal', 'info');
      return;
    }
    setSubmitting(true);
    const payload = {
      category_id: parseInt(category_id),
      amount: parseFloat(amount),
      description,
      transaction_date: date,
      type,
      source: 'manual',
    };
    const result = await addTransaction(payload);
    setSubmitting(false);
    if (result) navigate('/transactions');
  };

  return (
    <form className='py-2 px-4 max-w-2xl' onSubmit={onSubmitHandler}>
      <h1 className='p-2 text-gray-700 text-2xl font-bold'>Tambah Transaksi</h1>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Waktu:</span>
        <input
          type='date'
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          required
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Kategori:</span>
        <select
          value={category_id}
          onChange={(e) => setCategoryId(e.target.value)}
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          required
        >
          <option value=''>Pilih kategori</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Keterangan:</span>
        <input
          type='text'
          placeholder='Masukan keterangan...'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Nominal:</span>
        <input
          type='number'
          placeholder='Masukan nominal...'
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          required
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Tipe:</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
        >
          <option value='income'>Masuk</option>
          <option value='expense'>Keluar</option>
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

export default NewTransaction;
