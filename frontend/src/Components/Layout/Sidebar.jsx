import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { FiPlusCircle, FiLogOut, FiX } from 'react-icons/fi';
import { MdDashboard, MdInventory } from 'react-icons/md';
import { FaCashRegister, FaMoneyBill } from 'react-icons/fa';
import { FaUserGroup } from 'react-icons/fa6';
import { LuLogs } from 'react-icons/lu';
import logo from '../../../images/logo.png';

function Sidebar({ onClose }) {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout gagal:', error);
    }
  };

  const menuItems = [
    { name: 'Dashboard', icon: <MdDashboard size={22} />, path: '/dashboard' },
    {
      name: 'Catatan Keuangan',
      icon: <FaMoneyBill size={22} />,
      path: '/transactions',
    },
    {
      name: 'Manajemen Stok',
      icon: <MdInventory size={22} />,
      path: '/stocks',
    },
    { name: 'POS Terminal', icon: <FaCashRegister size={22} />, path: '/pos' },
    {
      name: 'Hutang Pelanggan',
      icon: <FaUserGroup size={22} />,
      path: '/debts',
    },
    { name: 'Log Inventori', icon: <LuLogs size={22} />, path: '/logs' },
  ];

  return (
    <div className='w-64 h-full bg-white border-r border-gray-200 flex flex-col overflow-y-auto shadow-lg lg:shadow-none'>
      {/* Header dengan tombol close di mobile */}
      <div className='flex items-center justify-between px-4 py-4'>
        <div className='flex items-center'>
          <img src={logo} alt='logo' className='h-10 w-10 md:h-14 md:w-14' />
          <h1 className='font-bold py-1 px-2 text-2xl md:text-3xl'>
            Fin<span className='text-orange-300'>Sense</span>
          </h1>
        </div>
        <button
          onClick={onClose}
          className='lg:hidden text-gray-500 hover:text-gray-700'
        >
          <FiX size={24} />
        </button>
      </div>

      {/* New Item */}
      <div className='mx-4 mt-2'>
        <NavLink
          to='/new'
          onClick={onClose}
          className='w-full bg-sky-950 text-white font-bold rounded-lg py-3 flex items-center justify-center gap-3'
        >
          <FiPlusCircle size={20} />
          <span>New Item</span>
        </NavLink>
      </div>

      {/* Menu Items */}
      <div className='mx-4 mt-8 text-sm'>
        {menuItems.map((item) => (
          <div key={item.name} className='mb-2'>
            <NavLink
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `w-full py-3 flex items-center justify-start rounded-lg transition ${
                  isActive
                    ? 'bg-sky-100 text-sky-900 font-bold border-l-4 border-sky-800'
                    : 'text-gray-500 font-medium border-l-4 border-transparent hover:bg-gray-50'
                }`
              }
            >
              <div className='mx-4'>{item.icon}</div>
              <span>{item.name}</span>
            </NavLink>
          </div>
        ))}
      </div>

      {/* Bottom Section */}
      <div className='flex flex-col mt-auto py-4 text-gray-600'>
        <hr className='border-t border-gray-300 mx-4 mb-4' />
        <button
          onClick={handleLogout}
          className='flex mx-4 py-2 px-2 gap-2 items-center cursor-pointer hover:bg-gray-300 rounded-lg hover:text-gray-900 transition-colors'
        >
          <FiLogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
