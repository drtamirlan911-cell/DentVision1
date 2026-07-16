import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface CartItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  qty: number;
  imageUrl?: string | null;
}

export interface FavItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  rating: number;
}

interface CartContextType {
  cart: CartItem[];
  favorites: FavItem[];
  cartCount: number;
  cartTotal: number;
  addToCart: (product: Omit<CartItem, 'qty'>) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  toggleFav: (product: Omit<FavItem, 'qty'>) => void;
  isFav: (id: string) => boolean;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_KEY = 'dv_cart';
const FAV_KEY = 'dv_favs';

function loadCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}
function loadFavs(): FavItem[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [favorites, setFavorites] = useState<FavItem[]>(loadFavs);

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)); }, [favorites]);

  const addToCart = useCallback((product: Omit<CartItem, 'qty'>) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, qty) } : i));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleFav = useCallback((product: Omit<FavItem, 'qty'>) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.id === product.id);
      if (exists) return prev.filter(f => f.id !== product.id);
      return [...prev, product];
    });
  }, []);

  const isFav = useCallback((id: string) => favorites.some(f => f.id === id), [favorites]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <CartContext.Provider
      value={{ cart, favorites, cartCount, cartTotal, addToCart, removeFromCart, updateQty, clearCart, toggleFav, isFav }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
