import { create } from 'zustand'

export interface CartItem {
  id: string
  name: string
  brand: string
  price: number
  qty: number
  imageUrl?: string | null
  supplierId?: string | null
  category?: string | null
  ownBrand?: boolean
}

export interface FavItem {
  id: string
  name: string
  brand: string
  price: number
  rating: number
}

interface CartState {
  cart: CartItem[]
  favorites: FavItem[]
  cartCount: number
  cartTotal: number
  addToCart: (product: Omit<CartItem, 'qty'>) => void
  removeFromCart: (id: string) => void
  updateQty: (id: string, qty: number) => void
  clearCart: () => void
  toggleFav: (product: Omit<FavItem, 'qty'>) => void
  isFav: (id: string) => boolean
}

const CART_KEY = 'dv_cart'
const FAV_KEY = 'dv_favs'

function loadCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') } catch { return [] }
}
function loadFavs(): FavItem[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] }
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: loadCart(),
  favorites: loadFavs(),
  cartCount: 0,
  cartTotal: 0,

  addToCart: (product) => {
    set((prev) => {
      const ex = prev.cart.find(i => i.id === product.id)
      const cart = ex
        ? prev.cart.map(i => i.id === product.id
          ? {
              ...i,
              qty: i.qty + 1,
              supplierId: i.supplierId || product.supplierId || null,
              category: i.category || product.category || null,
              ownBrand: i.ownBrand || product.ownBrand,
            }
          : i)
        : [...prev.cart, { ...product, qty: 1 }]
      const cartCount = cart.reduce((s, i) => s + i.qty, 0)
      const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
      try { localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch (e) { console.warn('localStorage unavailable:', e) }
      return { cart, cartCount, cartTotal }
    })
  },

  removeFromCart: (id) => {
    set((prev) => {
      const cart = prev.cart.filter(i => i.id !== id)
      const cartCount = cart.reduce((s, i) => s + i.qty, 0)
      const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
      try { localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch (e) { console.warn('localStorage unavailable:', e) }
      return { cart, cartCount, cartTotal }
    })
  },

  updateQty: (id, qty) => {
    set((prev) => {
      const cart = prev.cart.map(i => i.id === id ? { ...i, qty: Math.max(1, qty) } : i)
      const cartCount = cart.reduce((s, i) => s + i.qty, 0)
      const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
      try { localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch (e) { console.warn('localStorage unavailable:', e) }
      return { cart, cartCount, cartTotal }
    })
  },

  clearCart: () => {
    try { localStorage.removeItem(CART_KEY) } catch (e) { console.warn('localStorage unavailable:', e) }
    set({ cart: [], cartCount: 0, cartTotal: 0 })
  },

  toggleFav: (product) => {
    set((prev) => {
      const exists = prev.favorites.find(f => f.id === product.id)
      const favorites = exists
        ? prev.favorites.filter(f => f.id !== product.id)
        : [...prev.favorites, product]
      try { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)) } catch (e) { console.warn('localStorage unavailable:', e) }
      return { favorites }
    })
  },

  isFav: (id) => get().favorites.some(f => f.id === id),
}))

// Drop-in replacement for useCart from CartContext
export function useCart() {
  const state = useCartStore()
  return {
    cart: state.cart,
    favorites: state.favorites,
    cartCount: state.cart.reduce((s, i) => s + i.qty, 0),
    cartTotal: state.cart.reduce((s, i) => s + i.price * i.qty, 0),
    addToCart: state.addToCart,
    removeFromCart: state.removeFromCart,
    updateQty: state.updateQty,
    clearCart: state.clearCart,
    toggleFav: state.toggleFav,
    isFav: state.isFav,
  }
}
