import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../hooks/useCart';
import Swal from 'sweetalert2';
import { getProducts } from '../../../services/productService';

function NewPos() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [selectedProduct, setSelectedProduct] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await getProducts();
        setProducts(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProducts();
  }, []);

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    setSelectedProduct(prodId);
    if (prodId) {
      const prod = products.find((p) => String(p.id) === String(prodId));
      if (prod) {
        setPrice(prod.price);
      }
    } else {
      setPrice('');
    }
  };

  const onSubmitHandler = (e) => {
    e.preventDefault();
    if (!selectedProduct || !price || !qty) {
      Swal.fire('Perhatian', 'Lengkapi semua data', 'info');
      return;
    }
    const prod = products.find((p) => String(p.id) === String(selectedProduct));

    if (!prod) {
      Swal.fire('Error', 'Produk tidak ditemukan', 'error');
      return;
    }

    addItem({
      id: prod.id,
      name: prod.name,
      price: parseInt(price),
      qty: parseInt(qty),
    });
    Swal.fire('Sukses', 'Item ditambahkan ke keranjang', 'success');
    navigate('/pos');
  };

  return (
    <form className='py-2 px-4 max-w-2xl' onSubmit={onSubmitHandler}>
      {/* Header */}
      <h1 className='p-2 text-gray-700 text-2xl font-bold'>Tambah POS Baru</h1>

      {/* input nama barang */}
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Nama Barang:</span>
        <select
          value={selectedProduct}
          onChange={handleProductChange}
          className='w-full p-2 border-2 border-solid border-gray-300 rounded-lg'
        >
          <option value=''>Pilih Barang dari Stok</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} - Rp {p.price?.toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      {/* input jumlah stok */}
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Jumlah Barang:</span>
        <input
          type='number'
          className='w-full p-2 border-2 border-solid border-gray-300 rounded-lg'
          placeholder='Masukan jumlah Barang...'
          value={qty}
          onChange={(n) => setQty(n.target.value)}
          min='1'
        />
      </div>

      {/* input harga barang */}
      <div className='px-2 mt-4 relative flex flex-col gap-2'>
        <span className='font-bold'>Harga:</span>
        <input
          type='number'
          className='w-full p-2 border-2 border-solid border-gray-300 rounded-lg'
          placeholder='Masukan harga barang...'
          value={price}
          onChange={(n) => setPrice(n.target.value)}
        />
      </div>

      <button className='flex items-center py-2 px-4 mx-2 mt-4 gap-2 cursor-pointer bg-sky-950 text-white font-semibold border rounded-lg hover:bg-white hover:text-sky-950 hover:border hover:rounded-lg hover:border-sky-950 transition-all'>
        <span>Konfirmasi</span>
      </button>
    </form>
  );
}

export default NewPos;

