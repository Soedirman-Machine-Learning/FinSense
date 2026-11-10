import React, { useContext, useState } from 'react';
import SettingsModal from './SettingsModal';
import { useNavigate } from 'react-router-dom';
import { IoIosNotifications, IoIosSettings } from 'react-icons/io';
import { HiMenuAlt2 } from 'react-icons/hi';
import { AuthContext } from '../../context/AuthContext';

function Topbar({ onMenuClick }) {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  return (
    <>
      <div className='sticky top-0 z-30 flex items-center justify-between w-full py-3 px-4 md:py-4 border-b border-gray-200 bg-white'>
        {/* Kiri Tombol menu (mobile) + back */}
        <div className='flex items-center gap-2'>
          <button
            onClick={onMenuClick}
            className='lg:hidden text-gray-600 hover:text-gray-900 p-1 rounded-md focus:outline-none'
          >
            <HiMenuAlt2 size={28} />
          </button>
          <button
            onClick={() => navigate(-1)}
            className='hidden sm:block text-gray-500 hover:text-gray-700 p-1 rounded-md transition-colors'
          >
            <span className='text-2xl'>&larr;</span>
          </button>
        </div>

        {/* Kanan Settings, Profile */}
        <div className='flex items-center gap-2 md:gap-4 text-gray-500'>
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className='cursor-pointer hover:text-gray-700 transition-colors p-1'
          >
            <IoIosSettings size={26} />
          </button>
          <div className='pl-2 md:pl-4 border-l border-gray-300 font-semibold text-sky-950'>
            {user?.full_name || 'User'}
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </>
  );
}

export default Topbar;
