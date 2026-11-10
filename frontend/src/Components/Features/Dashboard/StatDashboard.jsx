import React from 'react';
import { useDashboardData } from '../../../hooks/useDashboardData';

const StatDashboard = () => {
  const {
    todayIncome,
    todayCount,
    averageOrder,
    loading,
    revenuePrediction,
    predictionMessage,
  } = useDashboardData();

  if (loading) {
    return <div className='flex gap-4'>Memuat statistik...</div>;
  }

  return (
    <div className='flex flex-col w-full gap-4'>
      {/* statistik asli dari hook */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <div className='bg-white p-4 border rounded-md border-gray-300 shadow-sm'>
          <h2 className='text-gray-500 text-sm font-semibold'>
            PEMASUKAN HARI INI
          </h2>
          <p className='text-xl md:text-2xl font-bold text-sky-950'>
            Rp {todayIncome.toLocaleString()}
          </p>
        </div>
        <div className='flex-1 bg-white p-4 border rounded-md border-gray-300 shadow-sm'>
          <h2 className='text-gray-500 text-sm font-semibold'>
            TOTAL TRANSAKSI HARI INI
          </h2>
          <p className='text-2xl font-bold text-sky-950'>{todayCount}</p>
        </div>
        <div className='flex-1 bg-white p-4 border rounded-md border-gray-300 shadow-sm'>
          <h2 className='text-gray-500 text-sm font-semibold'>
            RATA-RATA ORDER HARI INI
          </h2>
          <p className='text-2xl font-bold text-sky-950'>
            Rp {averageOrder.toLocaleString()}
          </p>
        </div>
      </div>

      {/* PREDIKSI PEMASUKAN */}
      {revenuePrediction && (
        <div className='w-full bg-blue-50 p-4 rounded-md shadow-sm border border-gray-300'>
          <div className='flex gap-1'>
            <h2 className='text-gray-500 text-sm font-semibold'>
              Prediksi Pemasukan Besok
            </h2>
            <span className='flex font-semibold items-start text-green-500 text-xs'>
              AI Powered
            </span>
          </div>
          <p className='text-2xl font-bold text-blue-900 mb-2'>
            {typeof revenuePrediction.predicted_revenue === 'string' &&
            revenuePrediction.predicted_revenue === '......' ? (
              <span className='text-gray-400'>......</span>
            ) : (
              `Rp ${(
                revenuePrediction.predicted_revenue ?? 0
              ).toLocaleString()}`
            )}
          </p>
          {predictionMessage && (
            <p className='text-xs text-yellow-600'>{predictionMessage}</p>
          )}
          <p className='text-xs'>{revenuePrediction.prediction_date}</p>
        </div>
      )}
    </div>
  );
};

export default StatDashboard;