import React, { useState, useContext, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import Swal from 'sweetalert2';

function SettingsModal({ isOpen, onClose }) {
  const { user: contextUser, setUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // User Profile Form State
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
  });

  // UMKM Profile Form State
  const [umkmForm, setUmkmForm] = useState({
    business_name: '',
    business_type: '',
    province: '',
    city: '',
    monthly_revenue_est: '',
    employee_count: '',
  });

  // Fetch user and UMKM profiles when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchProfiles = async () => {
        setProfileLoading(true);
        try {
          // Fetch user profile
          const userRes = await api.get('/auth/profile');
          const userData = userRes.data;
          setUserForm({
            full_name: userData.full_name || '',
            email: userData.email || '',
          });
          // Fetch UMKM profile
          const umkmRes = await api.get('/umkm');
          const umkmData = umkmRes.data;
          setUmkmForm({
            business_name: umkmData.business_name || '',
            business_type: umkmData.business_type || '',
            province: umkmData.province || '',
            city: umkmData.city || '',
            monthly_revenue_est: umkmData.monthly_revenue_est || '',
            employee_count: umkmData.employee_count || '',
          });
        } catch (err) {
          console.error(err);
        } finally {
          setProfileLoading(false);
        }
      };
      fetchProfiles();
    }
  }, [isOpen]);

  const handleUserFormChange = (e) => {
    const { name, value } = e.target;
    setUserForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUmkmFormChange = (e) => {
    const { name, value } = e.target;
    setUmkmForm((prev) => ({ ...prev, [name]: value }));
  };

  // Update profil user (only full_name)
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.put('/auth/profile', {
        full_name: userForm.full_name,
        email: userForm.email,
      });
      // Update context user
      setUser((prev) => ({ ...prev, full_name: response.data.full_name }));
      Swal.fire('Berhasil', 'Profil berhasil diperbarui', 'success');
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Gagal memperbarui profil';
      Swal.fire('Gagal', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Update profil UMKM (POST /umkm)
  const handleUmkmSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        business_name: umkmForm.business_name,
        business_type: umkmForm.business_type,
        province: umkmForm.province,
        city: umkmForm.city,
        monthly_revenue_est: umkmForm.monthly_revenue_est
          ? parseFloat(umkmForm.monthly_revenue_est)
          : null,
        employee_count: umkmForm.employee_count
          ? parseInt(umkmForm.employee_count)
          : null,
      };
      const response = await api.post('/umkm', payload);
      // Update context user with new umkm_profile
      setUser((prev) => ({ ...prev, umkm_profile: response.data }));
      Swal.fire('Berhasil', 'Profil UMKM berhasil diperbarui', 'success');
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Gagal memperbarui profil UMKM';
      Swal.fire('Gagal', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <div className='bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
        {/* Header */}
        <div className='sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center'>
          <h2 className='text-2xl font-bold text-gray-900'>Pengaturan</h2>
          <button
            onClick={onClose}
            className='text-gray-500 hover:text-gray-700 transition-colors'
          >
            <IoClose size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className='flex border-b border-gray-200 px-6'>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'profile'
                ? 'border-sky-950 text-sky-950'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            User
          </button>
          <button
            onClick={() => setActiveTab('umkm')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'umkm'
                ? 'border-sky-950 text-sky-950'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            UMKM
          </button>
        </div>

        {/* Content */}
        <div className='p-6'>
          {profileLoading && (
            <div className='text-center py-8'>Memuat data...</div>
          )}
          {!profileLoading && (
            <>
              {/* Profile User Tab */}
              {activeTab === 'profile' && (
                <form onSubmit={handleUserSubmit}>
                  <div className='space-y-4'>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-2'>
                        Nama Lengkap
                      </label>
                      <input
                        type='text'
                        name='full_name'
                        value={userForm.full_name}
                        onChange={handleUserFormChange}
                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition'
                        placeholder='Masukkan nama lengkap'
                        required
                      />
                    </div>

                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-2'>
                        Email
                      </label>
                      <input
                        type='email'
                        name='email'
                        value={userForm.email}
                        onChange={handleUserFormChange}
                        className='w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500'
                      />
                      {/* <p className='text-xs text-gray-400 mt-1'>
                        Email tidak dapat diubah
                      </p> */}
                    </div>

                    <div className='pt-4 flex gap-3 justify-end'>
                      <button
                        type='button'
                        onClick={onClose}
                        className='px-6 py-2 text-gray-700 border border-gray-400 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer'
                      >
                        Batal
                      </button>
                      <button
                        type='submit'
                        disabled={loading}
                        className='px-6 py-2 bg-sky-950 text-white rounded-lg hover:bg-sky-900 transition-colors disabled:opacity-50 cursor-pointer'
                      >
                        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Profile UMKM Tab */}
              {activeTab === 'umkm' && (
                <form onSubmit={handleUmkmSubmit}>
                  <div className='space-y-4'>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-2'>
                        Nama Bisnis
                      </label>
                      <input
                        type='text'
                        name='business_name'
                        value={umkmForm.business_name}
                        onChange={handleUmkmFormChange}
                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition'
                        placeholder='Masukkan nama bisnis'
                      />
                    </div>

                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-2'>
                        Jenis Bisnis
                      </label>
                      <input
                        type='text'
                        name='business_type'
                        value={umkmForm.business_type}
                        onChange={handleUmkmFormChange}
                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition'
                        placeholder='Contoh: Makanan, Fashion, Elektronik'
                      />
                    </div>

                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-2'>
                          Provinsi
                        </label>
                        <input
                          type='text'
                          name='province'
                          value={umkmForm.province}
                          onChange={handleUmkmFormChange}
                          className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition'
                          placeholder='Provinsi'
                        />
                      </div>

                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-2'>
                          Kota
                        </label>
                        <input
                          type='text'
                          name='city'
                          value={umkmForm.city}
                          onChange={handleUmkmFormChange}
                          className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition'
                          placeholder='Kota'
                        />
                      </div>
                    </div>

                    <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-2'>
                          Estimasi Pendapatan Bulanan (Rp)
                        </label>
                        <input
                          type='number'
                          name='monthly_revenue_est'
                          value={umkmForm.monthly_revenue_est}
                          onChange={handleUmkmFormChange}
                          className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition'
                          placeholder='0'
                        />
                      </div>

                      <div>
                        <label className='block text-sm font-medium text-gray-700 mb-2'>
                          Jumlah Karyawan
                        </label>
                        <input
                          type='number'
                          name='employee_count'
                          value={umkmForm.employee_count}
                          onChange={handleUmkmFormChange}
                          className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none transition'
                          placeholder='0'
                        />
                      </div>
                    </div>

                    <div className='pt-4 flex gap-3 justify-end'>
                      <button
                        type='button'
                        onClick={onClose}
                        className='px-6 py-2 text-gray-700 border border-gray-400 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer'
                      >
                        Batal
                      </button>
                      <button
                        type='submit'
                        disabled={loading}
                        className='px-6 py-2 bg-sky-950 text-white rounded-lg hover:bg-sky-900 transition-colors disabled:opacity-50 cursor-pointer'
                      >
                        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
