import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getTransactionById,
  updateTransaction,
} from '../../../services/transactionService';
import Swal from 'sweetalert2';

function EditTransaction() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    date: '',
    category_id: '',
    description: '',
    amount: '',
    type: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([
    { id: 1, name: 'Penjualan' },
    { id: 2, name: 'Restok' },
    { id: 3, name: 'Operasional' },
    { id: 4, name: 'Gaji Karyawan' },
    { id: 5, name: 'Bayar Hutang' },
    { id: 6, name: 'Hutang Pelanggan' },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getTransactionById(id);
        const tx = response.data;
        setFormData({
          date: tx.transaction_date ? tx.transaction_date.split('T')[0] : '',
          category_id: tx.category_id,
          description: tx.description || '',
          amount: tx.amount,
          type: tx.type,
        });
      } catch (err) {
        Swal.fire('Error', 'Gagal memuat data transaksi', 'error');
        navigate('/transactions');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    if (!formData.category_id || !formData.amount || !formData.type) {
      Swal.fire('Perhatian', 'Lengkapi semua data', 'info');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        category_id: parseInt(formData.category_id),
        amount: parseFloat(formData.amount),
        description: formData.description,
        transaction_date: formData.date,
        type: formData.type,
        source: 'manual',
      };
      await updateTransaction(id, payload);
      Swal.fire('Sukses', 'Transaksi berhasil diperbarui', 'success');
      navigate(`/transactions/${id}`);
    } catch (err) {
      Swal.fire(
        'Gagal',
        err.response?.data?.error || 'Gagal memperbarui transaksi',
        'error',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className='p-6'>Memuat data...</div>;

  return (
    <form onSubmit={onSubmitHandler}>
      <h1 className='text-2xl font-bold text-gray-800'>Edit Transaksi</h1>
      <p className='mb-2 mt-2 text-sm text-gray-500'>ID Transaksi: {id}</p>

      <div className='grid grid-cols-2 gap-2 border-t pt-2'>
        <p className='flex items-center font-semibold text-gray-600'>
          Tanggal:
        </p>
        <input
          type='date'
          name='date'
          value={formData.date}
          onChange={handleChange}
          className='p-2 border border-gray-400 rounded'
          required
        />

        <p className='flex items-center font-semibold text-gray-600'>
          Kategori:
        </p>
        <select
          name='category_id'
          value={formData.category_id}
          onChange={handleChange}
          className='p-2 border border-gray-400 rounded'
          required
        >
          <option value=''>Pilih Kategori</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <p className='flex items-center font-semibold text-gray-600'>
          Keterangan:
        </p>
        <input
          type='text'
          name='description'
          value={formData.description}
          onChange={handleChange}
          className='p-2 border border-gray-400 rounded'
        />

        <p className='flex items-center font-semibold text-gray-600'>
          Nominal:
        </p>
        <input
          type='number'
          name='amount'
          value={formData.amount}
          onChange={handleChange}
          className='p-2 border border-gray-400 rounded'
          required
        />

        <p className='flex items-center font-semibold text-gray-600'>Tipe:</p>
        <select
          name='type'
          value={formData.type}
          onChange={handleChange}
          className='p-2 border border-gray-400 rounded'
          required
        >
          <option value='income'>Masuk</option>
          <option value='expense'>Keluar</option>
        </select>
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

export default EditTransaction;
