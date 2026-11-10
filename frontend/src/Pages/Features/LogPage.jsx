import React, { useState } from 'react';
import StatLog from '../../Components/Features/Log/StatLog';
import TableLog from '../../Components/Features/Log/TableLog';
import { useNavigate } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';
import { FaCirclePlus } from 'react-icons/fa6';

function LogPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4'>
        <h1 className='text-xl md:text-2xl font-bold'>Log Barang</h1>
        <button
          onClick={() => navigate('/logs/new')}
          className='flex items-center gap-2 cursor-pointer bg-sky-950 p-2 px-4 text-white font-semibold border rounded-lg hover:bg-white hover:text-sky-950 transition-all'
        >
          <FaCirclePlus size={16} />
          <span>Tambah Log baru</span>
        </button>
      </div>
      <StatLog />

      {/* Search Bar */}
      <div className='relative mt-4 max-w-md'>
        <input
          type='text'
          placeholder='Cari berdasarkan nama produk atau SKU...'
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className='w-full p-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2'
        />
        <FaSearch className='absolute left-3 top-3 text-gray-400' />
      </div>

      <div className='overflow-x-auto mt-2'>
        <TableLog searchTerm={searchTerm} />
      </div>
    </div>
  );
}

export default LogPage;
