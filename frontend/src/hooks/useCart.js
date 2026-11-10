import { useState, useEffect, useCallback } from 'react';
import {
  getCart,
  addToCart,
  updateCartItemQty,
  removeFromCart,
  clearCart,
} from '../utils/cart';

export const useCart = () => {
  const [cart, setCart] = useState([]);

  const refreshCart = useCallback(() => {
    const items = getCart();
    setCart([...items]); // spread operator membuat array baru
  }, []);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addItem = useCallback(
    (item) => {
      addToCart(item);
      refreshCart();
    },
    [refreshCart],
  );

  const updateItem = useCallback(
    (id, qty) => {
      updateCartItemQty(id, qty);
      refreshCart();
    },
    [refreshCart],
  );

  const removeItem = useCallback(
    (id) => {
      removeFromCart(id);
      refreshCart();
    },
    [refreshCart],
  );

  const emptyCart = useCallback(() => {
    clearCart();
    refreshCart();
  }, [refreshCart]);

  return { cart, addItem, updateItem, removeItem, emptyCart };
};
