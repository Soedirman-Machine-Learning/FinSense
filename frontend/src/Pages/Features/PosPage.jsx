import React from 'react';
import InputPos from '../../Components/Features/Pos/InputPos';
import FrequentlyPos from '../../Components/Features/Pos/FrequentlyPos';
import CartPos from '../../Components/Features/Pos/CartPos';
import { useNavigate } from 'react-router-dom';

import { FaCirclePlus } from 'react-icons/fa6';

function PosPage() {
  const navigate = useNavigate();

  return (
    <div className='px-4 h-full flex flex-col'>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2'>
        <h1 className='text-2xl font-bold'>POS Terminal</h1>
        <button
          onClick={() => navigate('/pos/new')}
          className='flex items-center gap-2 bg-sky-950 p-2 px-4 text-white font-semibold border cursor-pointer rounded-lg hover:bg-white hover:text-sky-950 transition'
        >
          <FaCirclePlus size={16} />
          Tambah POS baru
        </button>
      </div>
      <div className='flex flex-col lg:flex-row gap-4 mt-4 flex-1'>
        <div className='flex flex-col gap-4 lg:w-3/4'>
          <InputPos />
          <FrequentlyPos />
        </div>
        <div className='border border-gray-400 rounded-md w-full lg:w-1/4'>
          <CartPos />
        </div>
      </div>
    </div>
  );
}

export default PosPage;
