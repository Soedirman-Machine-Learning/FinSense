import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const LoginInput = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  // Load saved email jika ada
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!login) {
      setError('Authentication tidak tersedia');
      setLoading(false);
      return;
    }

    try {
      await login(email, password);

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      navigate('/dashboard');
    } catch (err) {
      setError('Login gagal. Periksa email dan password.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='w-full'>
      {/* Email Input */}
      <div className='mb-4'>
        <label className='block text-gray-700 font-semibold mb-2 text-left'>
          Email
        </label>
        <input
          type='email'
          placeholder='Masukkan email Anda'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className='w-full p-3 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 transition-colors
                     text-gray-800 placeholder-gray-400'
          required
        />
      </div>

      {/* Password Input with Eye Icon */}
      <div className='mb-4'>
        <label className='block text-gray-700 font-semibold mb-2 text-left'>
          Password
        </label>
        <div className='relative'>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder='Masukkan password Anda'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className='w-full p-3 text-base border-2 border-gray-300 rounded-lg 
                       focus:outline-none focus:ring-2 transition-colors
                       text-gray-800 placeholder-gray-400'
            required
          />
          <button
            type='button'
            onClick={() => setShowPassword(!showPassword)}
            className='absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-1 hover:bg-gray-100 rounded-full transition-colors'
            aria-label={
              showPassword ? 'Sembunyikan password' : 'Tampilkan password'
            }
          >
            {showPassword ? (
              <FaEyeSlash
                size={20}
                className='text-gray-500 hover:text-sky-700'
              />
            ) : (
              <FaEye size={20} className=' text-gray-500 hover:text-sky-700' />
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className='mb-4 p-2 bg-red-50 border border-red-200 rounded-lg'>
          <p className='text-red-600 text-sm text-center'>{error}</p>
        </div>
      )}

      {/* Remember Me & Forgot Password - SATU BARIS */}
      <div className='flex flex-row items-center justify-between mb-6'>
        <label className='flex items-center gap-2 cursor-pointer text-sky-950 font-semibold'>
          <input
            type='checkbox'
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className='w-4 h-4 border-2 border-gray-300 rounded accent-sky-950 
                       cursor-pointer hover:accent-sky-800 transition-colors'
          />
          <span className='select-none'>Ingat Saya</span>
        </label>
        <Link
          to='/lupa-password'
          className='text-orange-400 font-semibold cursor-pointer hover:text-orange-500 
                     transition-colors'
        >
          Lupa password?
        </Link>
      </div>

      {/* Login Button */}
      <button
        type='submit'
        disabled={loading}
        className='w-full bg-sky-950 text-white font-bold rounded-lg py-3
                   cursor-pointer transition-all duration-200
                   hover:bg-sky-900 active:scale-98
                   disabled:bg-gray-400 disabled:cursor-not-allowed'
      >
        {loading ? (
          <span className='flex items-center justify-center gap-2'>
            <svg
              className='animate-spin h-5 w-5 text-white'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
            >
              <circle
                className='opacity-25'
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='4'
              ></circle>
              <path
                className='opacity-75'
                fill='currentColor'
                d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
              ></path>
            </svg>
            Memproses...
          </span>
        ) : (
          'Log in'
        )}
      </button>

      {/* Linebreak */}
      <div className='relative my-6'>
        <div className='absolute inset-0 flex items-center'>
          <div className='w-full border-t border-gray-300'></div>
        </div>
        <div className='relative flex justify-center text-sm'>
          <span className='px-2 bg-white text-gray-500'>atau</span>
        </div>
      </div>

      {/* Footer Card - Buat Akun Baru */}
      <p className='text-gray-500 text-center'>
        Belum punya akun?{' '}
        <Link
          to='/register'
          className='text-orange-500 font-bold cursor-pointer hover:text-orange-600 
                     transition-colors'
        >
          Buat akun baru
        </Link>
      </p>
    </form>
  );
};

export default LoginInput;
