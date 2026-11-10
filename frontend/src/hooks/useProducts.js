import { useState, useEffect, useCallback } from 'react';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
} from '../services/productService';
import Swal from 'sweetalert2';

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getProducts();
      setProducts(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat produk');
      Swal.fire('Error', 'Gagal memuat data produk', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const addProduct = useCallback(
    async (productData) => {
      try {
        const response = await createProduct(productData);
        await fetchProducts();
        Swal.fire('Sukses', 'Produk berhasil ditambahkan', 'success');
        return response.data;
      } catch (err) {
        Swal.fire(
          'Gagal',
          err.response?.data?.error || 'Gagal menambah produk',
          'error',
        );
        return null;
      }
    },
    [fetchProducts],
  );

  const editProduct = useCallback(
    async (id, productData) => {
      try {
        const response = await updateProduct(id, productData);
        await fetchProducts();
        Swal.fire('Sukses', 'Produk berhasil diperbarui', 'success');
        return response.data;
      } catch (err) {
        Swal.fire(
          'Gagal',
          err.response?.data?.error || 'Gagal memperbarui produk',
          'error',
        );
        return null;
      }
    },
    [fetchProducts],
  );

  const removeProduct = useCallback(
    async (id) => {
      try {
        await deleteProduct(id);
        await fetchProducts();
        Swal.fire('Sukses', 'Produk berhasil dihapus', 'success');
        return true;
      } catch (err) {
        Swal.fire(
          'Gagal',
          err.response?.data?.error || 'Gagal menghapus produk',
          'error',
        );
        return false;
      }
    },
    [fetchProducts],
  );

  const adjustStock = useCallback(
    async (id, quantity, type, note = '') => {
      try {
        const response = await updateStock(id, { quantity, type, note });
        await fetchProducts(); // refresh stok
        Swal.fire(
          'Sukses',
          `Stok berhasil ${type === 'in' ? 'ditambah' : 'dikurangi'}`,
          'success',
        );
        return response.data;
      } catch (err) {
        Swal.fire(
          'Gagal',
          err.response?.data?.error || 'Gagal update stok',
          'error',
        );
        return null;
      }
    },
    [fetchProducts],
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    fetchProducts,
    addProduct,
    editProduct,
    removeProduct,
    adjustStock,
  };
};
