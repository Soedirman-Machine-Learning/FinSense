import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import api from '../../services/api';
import logo from '../../../images/logo.png';

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Password tidak cocok');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await api.post('/auth/reset-password', {
        token,
        newPassword: password,
      });
      setMessage(res.data.message);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-200'>
        <div className='bg-white p-8 rounded-2xl shadow-xl text-center'>
          <p className='text-red-500 mb-4'>
            Token tidak valid atau sudah kadaluarsa.
          </p>
          <Link to='/login' className='text-orange-500 font-bold'>
            Kembali ke Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-200 p-4'>
      <div className='bg-white rounded-2xl shadow-xl w-full max-w-md border border-gray-100 p-6 sm:p-8'>
        <div className='flex flex-col items-center'>
          {/* Logo dan Nama */}
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
            Reset Password
          </h2>
          <p className='text-gray-500 text-sm sm:text-base mb-6 text-center'>
            Masukkan password baru Anda.
          </p>

          <form onSubmit={handleSubmit} className='w-full'>
            {/* Field Password Baru */}
            <div className='mb-4'>
              <label className='block text-gray-700 text-sm font-bold mb-2'>
                Password Baru
              </label>
              <div className='relative'>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder='Minimal 6 karakter'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='w-full p-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:text-sky-800'
                  required
                />
                <button
                  type='button'
                  onClick={() => setShowPassword(!showPassword)}
                  className='absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-sky-700'
                >
                  {showPassword ? (
                    <FaEyeSlash size={20} />
                  ) : (
                    <FaEye size={20} />
                  )}
                </button>
              </div>
            </div>

            {/* Field Konfirmasi Password */}
            <div className='mb-4'>
              <label className='block text-gray-700 text-sm font-bold mb-2'>
                Konfirmasi Password
              </label>
              <div className='relative'>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder='Ulangi password baru'
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className='w-full p-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:text-sky-800'
                  required
                />
                <button
                  type='button'
                  onClick={() => setShowConfirm(!showConfirm)}
                  className='absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-sky-700'
                >
                  {showConfirm ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
                </button>
              </div>
            </div>

            {/* Pesan Sukses/Error */}
            {message && (
              <div className='bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg mb-4 text-sm'>
                {message}
              </div>
            )}
            {error && (
              <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm'>
                {error}
              </div>
            )}

            {/* Tombol Submit */}
            <button
              type='submit'
              disabled={loading}
              className='w-full bg-sky-950 text-white font-bold rounded-lg py-3 disabled:opacity-50 hover:bg-sky-800 transition-colors'
            >
              {loading ? 'Memproses...' : 'Reset Password'}
            </button>

            {/* Link Kembali ke Login */}
            <div className='mt-4 text-center'>
              <Link to='/login' className='text-orange-500 font-bold text-sm'>
                Kembali ke Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
