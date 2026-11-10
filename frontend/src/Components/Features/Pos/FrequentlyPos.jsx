import React, { useState, useEffect } from 'react';
import { getProducts } from '../../../services/productService';
import { useCart } from '../../../hooks/useCart';
import Swal from 'sweetalert2';

function FrequentlyPos() {
  const [products, setProducts] = useState([]);
  const { addItem } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await getProducts();
        setProducts(res.data.slice(0, 6));
      } catch (err) {
        console.error(err);
      }
    };
    fetchProducts();
  }, []);

  const handleAdd = (product) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      qty: 1,
    });
    Swal.fire({
      icon: 'success',
      title: 'Berhasil',
      text: `${product.name} ditambahkan ke keranjang`,
      timer: 1500,
      showConfirmButton: false,
    }).then(() => {
      window.location.reload();
    });
  };

  return (
    <div className='mt-4'>
      <p className='text-lg font-semibold px-2 py-2'>Produk Sering Dibeli</p>
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 px-2'>
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => handleAdd(product)}
            className='p-4 border rounded-xl cursor-pointer hover:bg-gray-100'
          >
            <div className='font-semibold'>{product.name}</div>
            <div>
              Stok: {product.stock} {product.unit}
            </div>
            <div>Rp {product.price?.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FrequentlyPos;
