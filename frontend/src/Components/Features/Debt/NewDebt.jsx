import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebts } from '../../../hooks/useDebts';
import Swal from 'sweetalert2';

function NewDebt() {
  const navigate = useNavigate();
  const { addDebt } = useDebts();
  const [customer_name, setCustomerName] = useState('');
  const [total_debt, setTotalDebt] = useState('');
  const [due_date, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    if (!customer_name || !total_debt || !due_date) {
      Swal.fire({
        title: 'Mohon isi seluruh data',
        icon: 'info',
      });
      return;
    }
    setSubmitting(true);
    const success = await addDebt({
      customer_name,
      total_debt: Number(total_debt),
      due_date,
    });
    setSubmitting(false);
    if (success) navigate('/debts');
  };

  return (
    <form className='py-2 px-4 max-w-2xl' onSubmit={onSubmitHandler}>
      <h1 className='p-2 text-gray-700 text-2xl font-bold'>
        Tambah Piutang Baru
      </h1>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Nama Orang:</span>
        <input
          type='text'
          placeholder='Masukan nama orang...'
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={customer_name}
          onChange={(e) => setCustomerName(e.target.value)}
          required
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Total Hutang:</span>
        <input
          type='number'
          placeholder='Masukan total hutang...'
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={total_debt}
          onChange={(e) => setTotalDebt(e.target.value)}
          required
        />
      </div>
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Jatuh Tempo:</span>
        <input
          type='date'
          className='w-full p-2 border-2 border-gray-300 rounded-lg'
          value={due_date}
          onChange={(e) => setDueDate(e.target.value)}
          required
        />
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

export default NewDebt;
