import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDebts } from '../../../hooks/useDebts';

function EditDebt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchDebtById, editDebt } = useDebts();
  const [customer_name, setName] = useState('');
  const [total_debt, setHutang] = useState('');
  const [due_date, setTempo] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDebtById(id);
        setName(data.customer_name);
        setHutang(data.total_debt);
        setTempo(data.due_date.split('T')[0]); // format yyyy-mm-dd
        setStatus(data.status);
      } catch (err) {
        navigate('/debts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, fetchDebtById, navigate]);

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const success = await editDebt(id, {
      customer_name,
      total_debt: Number(total_debt),
      due_date,
      status,
    });
    setSubmitting(false);
    if (success) navigate(`/debts/${id}`);
  };

  if (loading) return <div className='p-6'>Memuat data...</div>;

  return (
    <form onSubmit={onSubmitHandler}>
      <h1 className='text-2xl font-bold text-gray-800'>Edit Hutang</h1>
      <p className='mb-2 mt-2 text-sm text-gray-500'>ID Hutang: {id}</p>
      <div className='grid grid-cols-2 gap-2 border-t pt-2'>
        <p className='flex items-center font-semibold text-gray-600'>
          Nama Orang:
        </p>
        <input
          className='p-2 border border-gray-400 rounded'
          value={customer_name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <p className='flex items-center font-semibold text-gray-600'>
          Total Hutang:
        </p>
        <input
          type='number'
          className='p-2 border border-gray-400 rounded'
          value={total_debt}
          onChange={(e) => setHutang(e.target.value)}
          required
        />
        <p className='flex items-center font-semibold text-gray-600'>
          Jatuh Tempo:
        </p>
        <input
          type='date'
          className='p-2 border border-gray-400 rounded'
          value={due_date}
          onChange={(e) => setTempo(e.target.value)}
          required
        />
        <p className='flex items-center font-semibold text-gray-600'>Status:</p>
        <select
          className='p-2 border border-gray-400 rounded bg-white'
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value='pending'>Belum Lunas</option>
          <option value='paid'>Lunas</option>
          <option value='overdue'>Overdue</option>
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

export default EditDebt;
