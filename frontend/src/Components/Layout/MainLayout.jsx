import { useContext, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './Topbar';
import Chat from '../Features/Chat/Chat';
import { AuthContext } from '../../context/AuthContext';
import Loading from '../Loading';

function MainLayout() {
  const { user, loading } = useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return <Loading fullScreen text='Memuat dashboard...' />;
  }

  if (!user) {
    return <Navigate to='/login' replace />;
  }

  return (
    <div className='flex h-screen w-full bg-gray-100 relative'>
      {/* Sidebar untuk desktop & mobile */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:z-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Overlay untuk mobile saat sidebar terbuka */}
      {sidebarOpen && (
        <div
          className='fixed inset-0 bg-opacity-50 z-40 lg:hidden backdrop-blur-sm'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Konten utama */}
      <div className='flex-1 flex flex-col overflow-hidden w-full'>
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <div className='flex-1 overflow-y-auto p-4 md:p-6'>
          <Outlet />
        </div>
      </div>

      {/* Chat component – sesuaikan posisi di mobile */}
      <div className='fixed bottom-4 right-4 z-20'>
        <Chat />
      </div>
    </div>
  );
}

export default MainLayout;
