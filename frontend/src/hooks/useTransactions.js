import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../services/transactionService';
import Swal from 'sweetalert2';

export const useTransactions = (filters = {}) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const prevFiltersRef = useRef();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getTransactions(filters);
      setTransactions(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat transaksi');
      Swal.fire('Error', 'Gagal memuat data transaksi', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const filtersKey = JSON.stringify(filters);
    const prevKey = JSON.stringify(prevFiltersRef.current);
    if (filtersKey !== prevKey) {
      prevFiltersRef.current = filters;
      fetchTransactions();
    }
  }, [filters, fetchTransactions]);

  const addTransaction = useCallback(
    async (data) => {
      try {
        const response = await createTransaction(data);
        await fetchTransactions();
        Swal.fire('Sukses', 'Transaksi berhasil ditambahkan', 'success');
        return response.data;
      } catch (err) {
        Swal.fire(
          'Gagal',
          err.response?.data?.error || 'Gagal menambah transaksi',
          'error',
        );
        return null;
      }
    },
    [fetchTransactions],
  );

  const editTransaction = useCallback(
    async (id, data) => {
      try {
        const response = await updateTransaction(id, data);
        await fetchTransactions();
        Swal.fire('Sukses', 'Transaksi berhasil diperbarui', 'success');
        return response.data;
      } catch (err) {
        Swal.fire(
          'Gagal',
          err.response?.data?.error || 'Gagal memperbarui transaksi',
          'error',
        );
        return null;
      }
    },
    [fetchTransactions],
  );

  const removeTransaction = useCallback(
    async (id) => {
      try {
        await deleteTransaction(id);
        await fetchTransactions();
        Swal.fire('Sukses', 'Transaksi berhasil dihapus', 'success');
        return true;
      } catch (err) {
        Swal.fire(
          'Gagal',
          err.response?.data?.error || 'Gagal menghapus transaksi',
          'error',
        );
        return false;
      }
    },
    [fetchTransactions],
  );

  return {
    transactions,
    loading,
    error,
    fetchTransactions,
    addTransaction,
    editTransaction,
    removeTransaction,
  };
};
