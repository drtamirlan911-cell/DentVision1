# 06 — Marketplace (Shop)

## 6.1 Positioning

Marketplace — **P1 pillar** DentVision.

Эталон UX/операций: **Kaspi**  
- быстрый поиск  
- понятные карточки  
- доверие к продавцу  
- моментальный checkout  
- прозрачный статус заказа  
- повторные покупки без трения  

**Кто продаёт товары:** только **Поставщики** (`supplier`).  
DentVision — платформа и, опционально, operator of first-party catalog, но коммерческая модель seller-driven.

---

## 6.2 Who is the Buyer?

Персона **Покупатель**:

- Владелец клиники
- Админ / менеджер закупок
- Врач с правом закупа (policy)
- Учебные центры / лаборатории (later)

Покупатель часто приходит из CRM Inventory: «остаток критичен → купить».

---

## 6.3 Kaspi-class Experience Checklist

| Capability | Requirement |
|------------|-------------|
| Home | Personalized feed: частое, акции, «заканчивается у вас» |
| Search | Instant search + filters (brand, category, seller, price, city) |
| Product card | Photos, price, stock, seller rating, delivery ETA, variants |
| Comparison | Сравнить 2–3 offer/SKU |
| Cart | Persistent cart, multi-seller aware rules |
| Checkout | Минимум шагов; saved requisites; delivery/pickup |
| Payments | Local methods first (cards, transfer; Kaspi Pay-class UX where available) |
| Orders | Timeline statuses like parcel tracking |
| Reorder | One-tap from history |
| Reviews | Ratings for product + supplier reliability |
| AI | «Подбери анестетик под наш расход» / auto purchase list |

---

## 6.4 Supplier Model

### 6.4.1 Supplier Account

Поставщик получает Seller Cabinet:

- Каталог (CRUD)
- Остатки и цены
- Заказы и статусы
- Финансы / payouts (phased)
- Рейтинг и SLA
- Документы юрлица
- Акции и витрины

### 6.4.2 Trust & Quality

- KYC/KYB поставщика до публикации
- Mandatory product attributes (SKU, unit, certificates where needed)
- Penalty for late cancel / fake stock
- Badge levels: New → Verified → Preferred

### 6.4.3 What Suppliers Sell

- Расходники
- Инструменты
- Оборудование
- Лабораторные материалы
- Сопутствующие товары для клиник
- (Later) digital goods bundles with School — осторожно, secondary

---

## 6.5 Integration with CRM Inventory

Критический loop платформы:

```text
Inventory min breach
  → AI alert
  → Marketplace offers ranked
  → Cart / Order
  → Delivery
  → Stock inbound auto-suggested
```

Без этого Shop — витрина.  
С этим Shop — операционный двигатель клиники.

---

## 6.6 Information Architecture

```text
/shop
  /shop/search
  /shop/category/:slug
  /shop/product/:id
  /shop/cart
  /shop/checkout
  /shop/orders
  /shop/orders/:id
  /shop/favorites
  /shop/suppliers
  /shop/suppliers/:id
  /supplier (seller cabinet)
  /admin/shop (platform ops)
```

---

## 6.7 Order State Machine

```text
draft → placed → paid → packing → shipped → delivered → closed
                 ↘ cancelled
                 ↘ refunded (partial/full)
```

Каждый переход видим покупателю и поставщику; AI может отвечать «где мой заказ?» фактами из state machine.

---

## 6.8 Monetization (product-level)

Возможные модели (выбрать/комбинировать в business plan):

1. Take-rate с заказа
2. Подписка Preferred Seller
3. Sponsored placements (с этичной маркировкой)
4. Logistics add-on
5. Bundles CRM+Shop procurement plans

Спека фиксирует, что **монетизация не должна ухудшать Kaspi-class скорость checkout**.

---

## 6.9 Acceptance Criteria

- [ ] Поставщик может выложить товар и получить заказ end-to-end
- [ ] Покупатель оформляет повторный заказ ≤ 60 секунд (warm path)
- [ ] Из склада CRM можно создать корзину одним действием
- [ ] Статусы заказа прозрачны как трекинг посылки
- [ ] AI Buyer assist работает на реальных остатках и истории закупок
- [ ] Нет «мертвых» товаров без seller и stock semantics
