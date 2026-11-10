import api from './api';

export const getDebts = () => api.get('/debts');
export const createDebt = (data) => api.post('/debts', data);

export const addPayment = (id, paymentData) =>
  api.post(`/debts/${id}/pay`, paymentData);

export const deleteDebt = (id) => api.delete(`/debts/${id}`);

export const getDebtById = (id) => api.get(`/debts/${id}`);
export const updateDebt = (id, data) => api.put(`/debts/${id}`, data);
