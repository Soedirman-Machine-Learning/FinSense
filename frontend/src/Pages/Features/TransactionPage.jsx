import React, { useState } from 'react';
import StatTransaction from '../../Components/Features/Transaction/StatTransaction';
import TableTransaction from '../../Components/Features/Transaction/TableTransaction';
import SummaryTransaction from '../../Components/Features/Transaction/SummaryTransaction';
import { useNavigate } from 'react-router-dom';
import { FaCirclePlus } from 'react-icons/fa6';
import { FaCalendarAlt } from 'react-icons/fa';

function TransactionPage() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Reset filter
  const handleReset = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2'>
        <h1 className='text-2xl font-bold'>Catatan keuangan</h1>
        <button
          onClick={() => navigate('/transactions/new')}
          className='flex items-center gap-2 bg-sky-950 p-2 px-4 text-white rounded-lg font-semibold border hover:bg-white hover:text-sky-950 transition cursor-pointer'
        >
          <FaCirclePlus size={16} /> Tambah Transaksi
        </button>
      </div>
      <StatTransaction />

      {/* Filter Tanggal */}
      <div className='flex flex-wrap items-center gap-4 mt-4 px-2'>
        <div className='flex items-center gap-2'>
          <FaCalendarAlt className='text-gray-500' />
          <span className='font-medium text-gray-700'>Filter Tanggal:</span>
        </div>
        <div className='flex flex-wrap gap-2 items-center'>
          <input
            type='date'
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className='p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500'
            placeholder='Mulai'
          />
          <span className='text-gray-500'>s/d</span>
          <input
            type='date'
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className='p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500'
            placeholder='Selesai'
          />
          <button
            onClick={handleReset}
            className='px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition'
          >
            Reset
          </button>
        </div>
      </div>

      <div className='overflow-x-auto mt-2'>
        <TableTransaction startDate={startDate} endDate={endDate} />
      </div>
      <div className='mt-4'>
        <hr />
      </div>
      <h1 className='p-2 text-2xl font-bold mt-2'>Ringkasan Keuangan</h1>
      <SummaryTransaction />
    </div>
  );
}

export default TransactionPage;
