import React, { useState } from 'react';
import StatStock from '../../Components/Features/Stock/StatStock';
import TableStock from '../../Components/Features/Stock/TableStock';
import { useNavigate } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';
import { FaCirclePlus } from 'react-icons/fa6';

function StockPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4'>
        <h1 className='text-xl md:text-2xl font-bold'>Manajemen Stok</h1>
        <button
          onClick={() => navigate('/stocks/new')}
          className='flex items-center gap-2 cursor-pointer bg-sky-950 p-2 px-4 text-white font-semibold border rounded-lg hover:bg-white hover:text-sky-950 transition-all'
        >
          <FaCirclePlus size={16} />
          <span>Tambah Stok baru</span>
        </button>
      </div>
      <StatStock />

      {/* Search Bar */}
      <div className='relative mt-4 max-w-md'>
        <input
          type='text'
          placeholder='Cari berdasarkan nama atau SKU...'
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className='w-full p-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-950'
        />
        <FaSearch className='absolute left-3 top-3 text-gray-400' />
      </div>

      <div className='overflow-x-auto mt-2'>
        <TableStock searchTerm={searchTerm} />
      </div>
    </div>
  );
}

export default StockPage;
