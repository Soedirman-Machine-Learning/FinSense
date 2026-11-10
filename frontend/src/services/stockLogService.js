import api from './api';

export const getStockLogs = (params) => api.get('/stock-logs', { params });
export const createStockLog = (data) => api.post('/stock-logs', data);
export const updateStockLog = (id, data) => api.put(`/stock-logs/${id}`, data);
export const deleteStockLog = (id) => api.delete(`/stock-logs/${id}`);
