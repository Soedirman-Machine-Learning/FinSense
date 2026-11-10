import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStockLogs } from '../../../hooks/useStockLogs';

function EditLog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { logs, editLog } = useStockLogs();
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const log = logs.find((l) => l.id === id);
    if (log) {
      setStatus(log.status);
      setNote(log.note || '');
      setLoading(false);
    } else if (logs.length > 0) {
      setLoading(false);
    }
  }, [logs, id]);

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await editLog(id, { status, note });
    setSubmitting(false);
    if (result) navigate(`/logs/${id}`);
  };

  if (loading) return <div className='p-6'>Memuat data...</div>;

  return (
    <form onSubmit={onSubmitHandler}>
      <h1 className='text-2xl font-bold text-gray-800'>Edit Log</h1>
      <p className='mb-2 mt-2 text-sm text-gray-500'>ID Log: {id}</p>
      <div className='grid grid-cols-2 gap-4 border-t pt-2'>
        <p className='flex items-center font-semibold text-gray-600'>Status:</p>
        <select
          className='p-2 border border-gray-400 rounded'
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value='completed'>Selesai</option>
          <option value='pending_audit'>Menunggu audit</option>
        </select>
        <p className='flex items-center font-semibold text-gray-600'>
          Catatan:
        </p>
        <input
          className='p-2 border border-gray-400 rounded'
          value={note}
          onChange={(e) => setNote(e.target.value)}
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

export default EditLog;
