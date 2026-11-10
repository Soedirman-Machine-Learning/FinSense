/* eslint-disable camelcase */

export let transactions = [];

export function addTransaction({ date, category, type, amount, description }) {
  transactions = [...transactions, {
    id: transactions.length + 1,
    date: date,
    category: category,
    description: description,
    amount: amount,
    type: type,
    source: 'manual',
    is_anomaly: false
  }];
}

export function getTransactionById(id) {
  const transactionfound = transactions.find((transaction) => transaction.id == id);
  return transactionfound;
}

export function updateTransaction({ id, date, category, description, amount, type, source }) {
  transactions = transactions.map((transaction) => {
    if (transaction.id == id) {
      return {
        ...transaction,
        date: date,
        category: category,
        description: description,
        amount: amount,
        type: type,
        source: source,
      };
    }
    return transaction;
  });
}

export function deleteTransaction(id) {
  transactions = transactions.filter((transaction) => transaction.id != id);
}