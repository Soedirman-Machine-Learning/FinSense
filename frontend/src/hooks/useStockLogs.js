import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getStockLogs,
  createStockLog,
  updateStockLog,
  deleteStockLog,
} from '../services/stockLogService';
import Swal from 'sweetalert2';

export const useStockLogs = (filters = {}) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const prevFiltersRef = useRef();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getStockLogs(filters);
      setLogs(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat log stok');
      Swal.fire('Error', 'Gagal memuat data log', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const filtersKey = JSON.stringify(filters);
    const prevKey = JSON.stringify(prevFiltersRef.current);
    if (filtersKey !== prevKey) {
      prevFiltersRef.current = filters;
      fetchLogs();
    }
  }, [filters, fetchLogs]);

  const addLog = useCallback(
    async (logData) => {
      try {
        const response = await createStockLog(logData);
        await fetchLogs();
        Swal.fire('Sukses', 'Log stok berhasil ditambahkan', 'success');
        return response.data;
      } catch (err) {
        Swal.fire(
          'Gagal',
          err.response?.data?.error || 'Gagal menambah log',
          'error',
        );
        return null;
      }
    },
    [fetchLogs],
  );

  const editLog = useCallback(
    async (id, logData) => {
      try {
        const response = await updateStockLog(id, logData);
        await fetchLogs();
        Swal.fire('Sukses', 'Log stok berhasil diperbarui', 'success');
        return response.data;
      } catch (err) {
        Swal.fire(
          'Gagal',
          err.response?.data?.error || 'Gagal memperbarui log',
          'error',
        );
        return null;
      }
    },
    [fetchLogs],
  );

  const removeLog = useCallback(
    async (id) => {
      try {
        await deleteStockLog(id);
        await fetchLogs();
        Swal.fire('Sukses', 'Log stok berhasil dihapus', 'success');
        return true;
      } catch (err) {
        Swal.fire(
          'Gagal',
          err.response?.data?.error || 'Gagal menghapus log',
          'error',
        );
        return false;
      }
    },
    [fetchLogs],
  );

  return { logs, loading, error, fetchLogs, addLog, editLog, removeLog };
};
