export let carts = [];

export function addCart({ name, price, qty }) {
  carts = [...carts, {
    id: carts.length + 1,
    name: name,
    price: Number(price),
    qty: Number(qty),
  }];
}

export function deleteCart(id) {
  carts = carts.filter((cart) => cart.id !== id);
}