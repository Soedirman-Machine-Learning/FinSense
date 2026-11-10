import React, { useState } from 'react';
import StatDebt from '../../Components/Features/Debt/StatDebt';
import TableDebt from '../../Components/Features/Debt/TableDebt';
import { useNavigate } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';
import { FaCirclePlus } from 'react-icons/fa6';
function Debtpage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4'>
        <h1 className='text-xl md:text-2xl font-bold'>Catatan Hutang</h1>
        <button
          onClick={() => navigate('/debts/new')}
          className='flex items-center gap-2 cursor-pointer bg-sky-950 p-2 px-4 text-white font-semibold border rounded-lg hover:bg-white hover:text-sky-950 transition-all'
        >
          <FaCirclePlus size={16} />
          <span>Tambah Hutang baru</span>
        </button>
      </div>
      <StatDebt />

      {/* Search Bar */}
      <div className='relative mt-4 max-w-md'>
        <input
          type='text'
          placeholder='Cari berdasarkan nama pelanggan...'
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className='w-full p-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2'
        />
        <FaSearch className='absolute left-3 top-3 text-gray-400' />
      </div>

      <div className='overflow-x-auto mt-2'>
        <TableDebt searchTerm={searchTerm} />
      </div>
    </div>
  );
}

export default Debtpage;
