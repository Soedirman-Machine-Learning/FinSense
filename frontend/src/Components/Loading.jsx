import React from 'react';
import { FiLoader, FiRefreshCw } from 'react-icons/fi';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { BiLoaderAlt } from 'react-icons/bi';

const Loading = ({ size = 'md', fullScreen = false, text = 'Loading...' }) => {
  // Ukuran icon berdasarkan prop size
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
    xl: 'text-8xl',
  };

  const iconSize = sizeClasses[size] || sizeClasses.md;

  // Jika fullScreen, tampilkan di tengah layar penuh
  if (fullScreen) {
    return (
      <div className='fixed inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50'>
        <div className='bg-white rounded-2xl p-8 shadow-xl flex flex-col items-center gap-4'>
          <AiOutlineLoading3Quarters
            className={`${iconSize} text-sky-950 animate-spin`}
          />
          <p className='text-gray-600 font-medium text-lg'>{text}</p>
        </div>
      </div>
    );
  }

  // Default: inline loading
  return (
    <div className='flex flex-col items-center justify-center p-8'>
      <div className='relative'>
        <FiLoader className={`${iconSize} text-sky-950 animate-spin`} />
        {/* Opsional: lingkaran luar yang berdenyut */}
        <div className='absolute inset-0 rounded-full bg-sky-950/10 animate-ping'></div>
      </div>
      {text && <p className='mt-4 text-gray-500 font-medium'>{text}</p>}
    </div>
  );
};

// Variasi: Skeleton Loading untuk konten
export const SkeletonLoader = ({ type = 'card', count = 1 }) => {
  if (type === 'card') {
    return (
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {[...Array(count)].map((_, i) => (
          <div
            key={i}
            className='bg-white rounded-xl shadow-md p-6 animate-pulse'
          >
            <div className='h-32 bg-gray-200 rounded-lg mb-4'></div>
            <div className='h-4 bg-gray-200 rounded w-3/4 mb-2'></div>
            <div className='h-3 bg-gray-200 rounded w-1/2'></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className='animate-pulse'>
        <div className='h-10 bg-gray-200 rounded-t-lg mb-2'></div>
        {[...Array(count)].map((_, i) => (
          <div key={i} className='h-12 bg-gray-100 mb-1 rounded'></div>
        ))}
      </div>
    );
  }

  // Skeleton untuk form
  return (
    <div className='space-y-4 animate-pulse'>
      {[...Array(count)].map((_, i) => (
        <div key={i}>
          <div className='h-4 bg-gray-200 rounded w-1/4 mb-2'></div>
          <div className='h-10 bg-gray-200 rounded w-full'></div>
        </div>
      ))}
    </div>
  );
};

// Loading Spinner kecil untuk tombol
export const ButtonSpinner = () => (
  <FiRefreshCw className='animate-spin text-white text-lg inline-block mr-2' />
);

export default Loading;
