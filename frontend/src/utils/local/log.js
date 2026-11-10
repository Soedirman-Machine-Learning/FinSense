export let logs = [
  { id: 1, waktu: '2026-05-02 10:42:00', produk: 'Kopi Arabika Gayo 1Kg', sku: 'KAG-1K-001', tipe: 'Stok Keluar', jumlah: -2, oleh: 'Kasir 1 (Budi)', status: 'Selesai' },
  { id: 2, waktu: '2026-05-02 09:15:00', produk: 'Susu UHT Full Cream 1L', sku: 'SUHT-1L-005', tipe: 'Stok Masuk', jumlah: 50, oleh: 'Gudang (Agus)', status: 'Selesai' },
  { id: 3, waktu: '2026-05-02 08:30:00', produk: 'Gula Pasir Premium 1Kg', sku: 'GPP-1K-002', tipe: 'Penyesuaian Manual', jumlah: -15, oleh: 'Admin (Siti)', status: 'Menunggu audit' },
  { id: 4, waktu: '2026-05-01 16:45:00', produk: 'Teh Hitam Celup', sku: 'THC-B-010', tipe: 'Stok Keluar', jumlah: -1, oleh: 'Kasir 2 (Dewi)', status: 'Selesai' },
  { id: 5, waktu: '2026-05-01 14:20:00', produk: 'Minyak Goreng 2L', sku: 'MNG-2L-015', tipe: 'Stok Masuk', jumlah: 100, oleh: 'Gudang (Agus)', status: 'Selesai' },
  { id: 6, waktu: '2026-05-01 11:10:00', produk: 'Beras Pandan Wangi 5Kg', sku: 'BPW-5K-022', tipe: 'Penyesuaian Manual', jumlah: -2, oleh: 'Admin (Siti)', status: 'Selesai' },
];

export function addLog({ waktu, produk, sku, tipe, jumlah, oleh, status }) {
  logs = [...logs, {
    id: logs.length + 1,
    waktu: waktu,
    produk: produk,
    sku: sku,
    tipe: tipe,
    jumlah: Number(jumlah),
    oleh: oleh,
    status: status,
  }];
}

export function getLogById(id) {
  const logfound = logs.find((stock) => stock.id === id);
  return logfound;
}

export function updateLog({ id, waktu, produk, sku, tipe, jumlah, oleh, status }) {
  logs = logs.map((logs) => {
    if (logs.id === id) {
      return {
        ...logs,
        waktu: waktu,
        produk: produk,
        sku: sku,
        tipe: tipe,
        jumlah: Number(jumlah),
        oleh: oleh,
        status: status,
      };
    }
    return logs;
  });
}

export function deleteLog(id) {
  logs = logs.filter((logs) => logs.id !== id);
}