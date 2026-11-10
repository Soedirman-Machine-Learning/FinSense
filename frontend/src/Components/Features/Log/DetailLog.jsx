import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStockLogs } from '../../../hooks/useStockLogs';
import swal from 'sweetalert2';

function DetailLog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { logs, removeLog } = useStockLogs();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const found = logs.find((l) => l.id === id);
    if (found) {
      setLog(found);
      setLoading(false);
    } else if (logs.length > 0) {
      setLoading(false);
    }
  }, [logs, id]);

  const onDeleteHandler = async () => {
    const result = await swal.fire({
      title: 'Hapus Log?',
      text: `Yakin ingin menghapus log ini "${log.product?.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#7f1d1d',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });
    if (result.isConfirmed) {
      const success = await removeLog(id);
      if (success) navigate('/logs');
    }
  };

  if (loading) return <div className='p-6'>Memuat detail...</div>;
  if (!log) return <div className='p-6'>Log tidak ditemukan</div>;

  return (
    <div>
      <h1 className='text-2xl font-bold text-gray-800'>Detail Log</h1>
      <p className='mb-2 mt-2 text-sm text-gray-500'>ID Log: {log.id}</p>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-2 border-t pt-4 mt-2'>
        <p className='font-semibold text-gray-600'>Waktu:</p>
        <p>{new Date(log.created_at).toLocaleString()}</p>
        <p className='font-semibold text-gray-600'>Nama Produk:</p>
        <p>{log.product?.name}</p>
        <p className='font-semibold text-gray-600'>SKU:</p>
        <p>{log.product?.sku}</p>
        <p className='font-semibold text-gray-600'>Tipe:</p>
        <p>
          {log.type === 'in'
            ? 'Stok Masuk'
            : log.type === 'out'
              ? 'Stok Keluar'
              : 'Penyesuaian'}
        </p>
        <p className='font-semibold text-gray-600'>Jumlah:</p>
        <p>{log.quantity}</p>
        <p className='font-semibold text-gray-600'>Oleh:</p>
        <p>{log.operator}</p>
        <p className='font-semibold text-gray-600'>Status:</p>
        <p>{log.status === 'completed' ? 'Selesai' : 'Menunggu audit'}</p>
        <p className='font-semibold text-gray-600'>Catatan:</p>
        <p>{log.note || '-'}</p>
      </div>
      <div className='flex gap-4 mt-4'>
        <button
          onClick={() => navigate(`/logs/edit/${id}`)}
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

export default DetailLog;
