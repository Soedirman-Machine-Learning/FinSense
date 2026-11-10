import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDebts } from '../../../hooks/useDebts';
import Swal from 'sweetalert2';

function DetailDebt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchDebtById, removeDebt, addPayment } = useDebts(); // tambah addPayment
  const [debt, setDebt] = useState(null);
  const [loading, setLoading] = useState(true);

  // State untuk modal pembayaran
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDebtById(id);
        setDebt(data);
      } catch (err) {
        navigate('/debts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, fetchDebtById, navigate]);

  const onDeleteHandler = async () => {
    const result = await Swal.fire({
      title: 'Hapus Hutang?',
      text: `Yakin ingin menghapus hutang "${debt?.customer_name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#7f1d1d',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });
    if (result.isConfirmed) {
      const success = await removeDebt(id);
      if (success) navigate('/debts');
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    console.log('Amount parsed:', amount, 'Type:', typeof amount);
    if (isNaN(amount) || amount <= 0) {
      Swal.fire('Error', 'Jumlah harus lebih dari 0', 'error');
      return;
    }
    if (amount > debt.total_debt - debt.paid_amount) {
      Swal.fire(
        'Error',
        `Pembayaran melebihi sisa hutang (Rp ${(debt.total_debt - debt.paid_amount).toLocaleString()})`,
        'error',
      );
      return;
    }

    setSubmitting(true);
    const result = await addPayment(id, { amount, note: paymentNote });
    setSubmitting(false);

    if (result) {
      Swal.fire('Sukses', 'Pembayaran berhasil dicatat', 'success');
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNote('');
      // Refresh data debt
      const updated = await fetchDebtById(id);
      setDebt(updated);
    }
  };

  if (loading) return <div className='p-6'>Memuat detail...</div>;
  if (!debt) return <div className='p-6'>Hutang tidak ditemukan</div>;

  const remainingDebt = debt.total_debt - debt.paid_amount;
  const isPaid = debt.status === 'paid';

  return (
    <div>
      <h1 className='text-2xl font-bold text-gray-800'>Detail Hutang</h1>
      <p className='mb-2 mt-2 text-sm text-gray-500'>ID Hutang: {debt.id}</p>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-2 border-t pt-4 mt-2'>
        <p className='font-semibold text-gray-600'>Nama Orang:</p>
        <p>{debt.customer_name}</p>
        <p className='font-semibold text-gray-600'>Total Hutang:</p>
        <p>Rp {debt.total_debt?.toLocaleString()}</p>
        <p className='font-semibold text-gray-600'>Telah Dibayar:</p>
        <p>Rp {debt.paid_amount?.toLocaleString()}</p>
        <p className='font-semibold text-gray-600'>Sisa Hutang:</p>
        <p
          className={
            remainingDebt > 0 ? 'text-red-600 font-bold' : 'text-green-600'
          }
        >
          Rp {remainingDebt.toLocaleString()}
        </p>
        <p className='font-semibold text-gray-600'>Jatuh Tempo:</p>
        <p>{new Date(debt.due_date).toLocaleDateString('id-ID')}</p>
        <p className='font-semibold text-gray-600'>Status:</p>
        <p>
          {debt.status === 'pending' && 'Belum Lunas'}
          {debt.status === 'partial' && 'Sebagian Lunas'}
          {debt.status === 'paid' && 'Lunas'}
          {debt.status === 'overdue' && 'Jatuh Tempo'}
        </p>
      </div>

      {/* Tombol aksi */}
      <div className='flex gap-4 mt-4 flex-wrap'>
        <button
          onClick={() => navigate(`/debts/edit/${id}`)}
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
        {!isPaid && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className='flex items-center gap-2 cursor-pointer bg-green-700 p-2 text-white font-semibold border rounded-lg hover:bg-white hover:text-green-700 transition-all'
          >
            Bayar Hutang
          </button>
        )}
      </div>

      {/* Riwayat Pembayaran */}
      {debt.payments && debt.payments.length > 0 && (
        <div className='mt-6 border-t pt-4'>
          <h2 className='text-xl font-semibold text-gray-700 mb-3'>
            Riwayat Pembayaran
          </h2>
          <div className='overflow-x-auto'>
            <table className='min-w-full bg-white border border-gray-200'>
              <thead className='bg-gray-100'>
                <tr>
                  <th className='px-4 py-2 text-left text-sm font-semibold'>
                    Tanggal
                  </th>
                  <th className='px-4 py-2 text-left text-sm font-semibold'>
                    Jumlah
                  </th>
                  <th className='px-4 py-2 text-left text-sm font-semibold'>
                    Catatan
                  </th>
                </tr>
              </thead>
              <tbody>
                {debt.payments.map((payment) => (
                  <tr key={payment.id} className='border-t'>
                    <td className='px-4 py-2 text-sm'>
                      {new Date(payment.paid_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className='px-4 py-2 text-sm'>
                      Rp {payment.amount?.toLocaleString()}
                    </td>
                    <td className='px-4 py-2 text-sm'>{payment.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Pembayaran */}
      {showPaymentModal && (
        <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-lg shadow-xl max-w-md w-full p-6'>
            <h2 className='text-xl font-bold mb-4'>Catat Pembayaran</h2>
            <p className='mb-2 text-sm text-gray-600'>
              Sisa hutang: <strong>Rp {remainingDebt.toLocaleString()}</strong>
            </p>
            <form onSubmit={handlePaymentSubmit}>
              <div className='mb-4'>
                <label className='block text-sm font-semibold mb-1'>
                  Jumlah Bayar (Rp)
                </label>
                <input
                  type='number'
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className='w-full p-2 border border-gray-300 rounded'
                  placeholder='Masukkan jumlah'
                  required
                  min='1'
                  max={remainingDebt}
                />
              </div>
              <div className='mb-4'>
                <label className='block text-sm font-semibold mb-1'>
                  Catatan (Opsional)
                </label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className='w-full p-2 border border-gray-300 rounded'
                  rows='2'
                  placeholder='Contoh: Pembayaran tunai'
                />
              </div>
              <div className='flex justify-end gap-2'>
                <button
                  type='button'
                  onClick={() => setShowPaymentModal(false)}
                  className='px-4 py-2 bg-gray-300 rounded hover:bg-gray-400'
                >
                  Batal
                </button>
                <button
                  type='submit'
                  disabled={submitting}
                  className='px-4 py-2 bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50'
                >
                  {submitting ? 'Menyimpan...' : 'Bayar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DetailDebt;
