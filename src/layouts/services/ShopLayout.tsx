import React from 'react'
import { ServiceLayout } from '../ServiceLayout'
import {
  ShoppingCart,
  Package,
  Star,
  Heart,
  Truck,
} from 'lucide-react'

const SHOP_NAV_ITEMS = [
  { id: 'catalog', label: 'Каталог', icon: <ShoppingCart size={18} />, path: '/shop' },
  { id: 'orders', label: 'Мои заказы', icon: <Package size={18} />, path: '/shop/orders' },
  { id: 'favorites', label: 'Избранное', icon: <Heart size={18} />, path: '/shop/favorites' },
  { id: 'suppliers', label: 'Поставщики', icon: <Truck size={18} />, path: '/shop/suppliers' },
]

export function ShopLayout() {
  return (
    <ServiceLayout
      navItems={SHOP_NAV_ITEMS}
      serviceName="DentVision Shop"
      serviceColor="#3498DB"
      serviceIcon={<ShoppingCart size={16} />}
    />
  )
}

export { SHOP_NAV_ITEMS }
