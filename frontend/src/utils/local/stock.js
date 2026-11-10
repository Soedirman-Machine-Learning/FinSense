export let stocks = [
  { id: 1, name: 'Beras Premium 5kg', sku: 'BRS-PR-01', qty: 45, status: 'Aman' },
  { id: 2, name: 'Minyak Goreng 2L', sku: 'MNG-GR-01', qty: 8, status: 'Menipis' },
  { id: 3, name: 'Gula Pasir 1kg', sku: 'GLA-PS-02', qty: 12, status: 'Menipis' },
  { id: 4, name: 'Tepung Terigu 1kg', sku: 'TPG-TR-02', qty: 25, status: 'Aman' },
];

export function addStock({ name, sku, qty }) {
  stocks = [...stocks, {
    id: stocks.length + 1,
    name: name,
    sku: sku,
    qty: Number(qty),
    status: Number(qty) > 10 ? 'Aman' : 'Menipis',
  }];
}

export function getStockById(id) {
  const stockfound = stocks.find((stock) => stock.id === id);
  return stockfound;
}

export function updateStock({ id, name, sku, qty }) {
  stocks = stocks.map((stocks) => {
    if (stocks.id === id) {
      return {
        ...stocks,
        name: name,
        sku: sku,
        qty: Number(qty),
        status: Number(qty) > 10 ? 'Aman' : 'Menipis',
      };
    }
    return stocks;
  });
}

export function deleteStock(id) {
  stocks = stocks.filter((stocks) => stocks.id !== id);
}
