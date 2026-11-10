const CART_KEY = 'pos_cart';

// Ambil keranjang dari localStorage
export const getCart = () => {
  const cart = localStorage.getItem(CART_KEY);
  return cart ? JSON.parse(cart) : [];
};

// Tambah item ke keranjang
export const addToCart = (item) => {
  const cart = getCart();
  const existingIndex = cart.findIndex((i) => i.id === item.id);
  if (existingIndex !== -1) {
    cart[existingIndex].qty += item.qty;
  } else {
    cart.push({ ...item, qty: item.qty });
  }
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  return cart;
};

// Update jumlah item
export const updateCartItemQty = (id, qty) => {
  const cart = getCart();
  const index = cart.findIndex((i) => i.id === id);
  if (index !== -1) {
    if (qty <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].qty = qty;
    }
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }
  return cart;
};

// Hapus item dari keranjang
export const removeFromCart = (id) => {
  const cart = getCart().filter((i) => i.id !== id);
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  return cart;
};

// Kosongkan keranjang
export const clearCart = () => {
  localStorage.removeItem(CART_KEY);
};
