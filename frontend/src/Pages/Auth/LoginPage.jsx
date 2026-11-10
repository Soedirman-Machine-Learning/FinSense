import React from 'react';
import LoginInput from '../../Components/Auth/Login/LoginInput.jsx';
import logo from '../../../images/logo.png';

function LoginPage() {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-200 p-4'>
      {/* Login Card */}
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 p-6 sm:p-8'>
        <div className='flex flex-col items-center'>
          {/* Logo and Name */}
          <div className='flex flex-row items-center mb-4'>
            <img
              src={logo}
              alt='logo'
              className='h-10 w-10 sm:h-12 sm:w-12 mx-2'
            />
            <h1 className='text-2xl sm:text-3xl font-bold text-sky-950'>
              Fin<span className='text-orange-400'>Sense</span>
            </h1>
          </div>

          <h2 className='text-xl sm:text-2xl font-bold text-sky-950 mb-2 text-center'>
            Selamat Datang
          </h2>
          <p className='text-gray-500 text-sm sm:text-base mb-6 text-center'>
            Masuk ke dashboard manajemen bisnis Anda.
          </p>

          <div className='w-full'>
            <LoginInput />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
