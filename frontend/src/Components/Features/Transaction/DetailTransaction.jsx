import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTransactionById } from '../../../services/transactionService';
import { useTransactions } from '../../../hooks/useTransactions';
import Swal from 'sweetalert2';

function DetailTransaction() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { removeTransaction } = useTransactions();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const response = await getTransactionById(id);
        setTransaction(response.data);
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Gagal memuat detail transaksi', 'error');
        navigate('/transactions');
      } finally {
        setLoading(false);
      }
    };
    fetchTransaction();
  }, [id, navigate]); // ✅ dependency stabil

  const onDeleteHandler = async () => {
    const result = await Swal.fire({
      title: 'Hapus Transaksi?',
      text: 'Yakin ingin menghapus transaksi ini?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#7f1d1d',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });
    if (result.isConfirmed) {
      const success = await removeTransaction(id);
      if (success) navigate('/transactions');
    }
  };

  if (loading) return <div className='p-6'>Memuat detail...</div>;
  if (!transaction) return <div className='p-6'>Transaksi tidak ditemukan</div>;

  return (
    <div>
      <h1 className='text-2xl font-bold text-gray-800'>Detail Transaksi</h1>
      <p className='mb-2 mt-2 text-sm text-gray-500'>
        ID Transaksi: {transaction.id}
      </p>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4 mt-2'>
        <p className='font-semibold text-gray-600'>Tanggal:</p>
        <p>
          {new Date(transaction.transaction_date).toLocaleDateString('id-ID')}
        </p>
        <p className='font-semibold text-gray-600'>Kategori:</p>
        <p>{transaction.category?.name || '-'}</p> {/* akses properti name */}
        <p className='font-semibold text-gray-600'>Keterangan:</p>
        <p>{transaction.description || '-'}</p>
        <p className='font-semibold text-gray-600'>Nominal:</p>
        <p>Rp {transaction.amount?.toLocaleString()}</p>
        <p className='font-semibold text-gray-600'>Tipe:</p>
        <p>{transaction.type === 'income' ? 'Masuk' : 'Keluar'}</p>
      </div>
      <div className='flex gap-4 mt-4'>
        <button
          onClick={() => navigate(`/transactions/edit/${id}`)}
          className='flex items-center gap-2 cursor-pointer bg-sky-950 p-2 text-white font-semibold border rounded-lg hover:bg-white hover:text-sky-950 transition-all'
        >
          Edit
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

export default DetailTransaction;
