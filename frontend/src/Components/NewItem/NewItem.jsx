import React from 'react';
import { useNavigate }  from 'react-router-dom';

function NewItem() {
  const navigate = useNavigate();

  const menuItems = [
    {
      title: 'Tambah Transaksi',
      description: 'Catat pemasukan atau pengeluaran yang dilakukan',
      link: '/transactions/new'
    },
    {
      title: 'Tambah Barang',
      description: 'Masukkan barang yang baru tiba atau restock',
      link: '/stocks/new'
    },
    {
      title: 'Tambah Log POS Terminal',
      description: 'Catat aktivitas terminal POS secara manual',
      link: '/pos/new'
    },
    {
      title: 'Tambah Piutang',
      description: 'Catat hutang atau piutang pelanggan',
      link: '/debts/new'
    },
    {
      title: 'Tambah Log Barang',
      description: 'Catat riwayat pergerakan dan penyesuaian',
      link: '/logs/new'
    }
  ];

  return (
    <div className="p-2">

      {/* Container */}
      <div className="flex flex-col gap-4 w-full sm:w-1/2">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => navigate(item.link)}
            className="flex flex-col items-start p-4 bg-sky-950 border rounded-md text-left hover:text-sky-950 hover:shadow-md hover:bg-white hover:border-sky-950 transition-all cursor-pointer group w-full"
          >
            <h3 className="text-lg font-bold text-white group-hover:text-sky-950">
              {item.title}
            </h3>
            <p className="text-sm text-sky-200 group-hover:text-gray-500 mt-1">
              {item.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default NewItem;