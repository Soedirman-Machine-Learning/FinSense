export let debts = [
  { id: 1, name: 'Budi', hutang: '1.250.000', tempo: '12 Desember 2026', status: 'Lunas' },
  { id: 2, name: 'Andi', hutang: '1.500.000', tempo: '13 Desember 2026', status: 'Belum Lunas' },
  { id: 3, name: 'Siti', hutang: '1.750.000', tempo: '14 Desember 2026', status: 'Belum Lunas' },
  { id: 4, name: 'Rina', hutang: '1.600.000', tempo: '15 Desember 2026', status: 'Lunas' },
  { id: 5, name: 'Doni', hutang: '1.400.000', tempo: '16 Desember 2026', status: 'Belum Lunas' },
  { id: 6, name: 'Eko', hutang: '2.100.000', tempo: '17 Desember 2026', status: 'Belum Lunas' },
  { id: 7, name: 'Maya', hutang: '950.000', tempo: '18 Desember 2026', status: 'Lunas' },
  { id: 8, name: 'Gani', hutang: '3.200.000', tempo: '19 Desember 2026', status: 'Belum Lunas' },
  { id: 9, name: 'Lia', hutang: '1.150.000', tempo: '20 Desember 2026', status: 'Lunas' },
  { id: 10, name: 'Fajar', hutang: '2.450.000', tempo: '21 Desember 2026', status: 'Belum Lunas' },
];

export function addDebt({ name, hutang, tempo }) {
  debts = [...debts, {
    id: debts.length + 1,
    name: name,
    hutang: hutang,
    tempo: tempo,
    status: 'Belum Lunas'
  }];
}

export function getDebtById(id) {
  const debtfound = debts.find((debt) => debt.id === id);
  return debtfound;
}

export function updateDebt({ id, name, hutang, tempo, status }) {
  debts = debts.map((debts) => {
    if (debts.id === id) {
      return {
        ...debts,
        name: name,
        hutang: hutang,
        tempo: tempo,
        status: status,
      };
    }
    return debts;
  });
}

export function deleteDebt(id) {
  debts = debts.filter((debts) => debts.id !== id);
}