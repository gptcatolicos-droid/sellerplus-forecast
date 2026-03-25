'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

const CART_KEY = 'ltc_cart';
const CART_EMAIL_KEY = 'ltc_cart_email';
const CART_ID_KEY = 'ltc_cart_id';
const CART_TTL_DAYS = 7;
const ABANDONED_MINUTES = 120; // 2 hours

interface CartItem {
  id: string;
  title: string;
  price_usd: number;
  price_cop: number;
  image_url?: string;
  supplier?: string;
  product_url?: string;
  quantity: number;
  added_at: number;
}

interface CartState {
  items: CartItem[];
  cartId: string;
  addItem: (item: Omit<CartItem, 'quantity' | 'added_at'>, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalUsd: number;
  setCustomerEmail: (email: string) => void;
}

const CartContext = createContext<CartState>({} as CartState);

function generateCartId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function isExpired(addedAt: number): boolean {
  const days = (Date.now() - addedAt) / (1000 * 60 * 60 * 24);
  return days > CART_TTL_DAYS;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState('');
  const abandonedTimer = useRef<NodeJS.Timeout | null>(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      // Get or create cart ID
      let id = localStorage.getItem(CART_ID_KEY) || generateCartId();
      localStorage.setItem(CART_ID_KEY, id);
      setCartId(id);

      // Load items, filter expired ones
      const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      const valid = stored.filter((item: CartItem) => !isExpired(item.added_at || 0));
      setItems(valid);
      if (valid.length !== stored.length) {
        localStorage.setItem(CART_KEY, JSON.stringify(valid));
      }
    } catch {}
  }, []);

  // Save to localStorage whenever items change
  useEffect(() => {
    if (cartId) {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
      window.dispatchEvent(new Event('cart-updated'));
    }
  }, [items, cartId]);

  // Abandoned cart — trigger email after 2 hours if cart has items and we have email
  const scheduleAbandonedEmail = useCallback((currentItems: CartItem[]) => {
    if (abandonedTimer.current) clearTimeout(abandonedTimer.current);
    if (!currentItems.length) return;

    abandonedTimer.current = setTimeout(async () => {
      const email = localStorage.getItem(CART_EMAIL_KEY);
      if (!email) return;

      try {
        await fetch('/api/abandoned-cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name: localStorage.getItem('ltc_customer_name') || '',
            items: currentItems,
            cartId: localStorage.getItem(CART_ID_KEY),
          }),
        });
      } catch {}
    }, ABANDONED_MINUTES * 60 * 1000);
  }, []);

  const addItem = useCallback((product: Omit<CartItem, 'quantity' | 'added_at'>, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      let updated: CartItem[];
      if (existing) {
        updated = prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + qty } : i);
      } else {
        updated = [...prev, { ...product, quantity: qty, added_at: Date.now() }];
      }
      scheduleAbandonedEmail(updated);
      return updated;
    });
  }, [scheduleAbandonedEmail]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) { removeItem(id); return; }
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    if (abandonedTimer.current) clearTimeout(abandonedTimer.current);
  }, []);

  const setCustomerEmail = useCallback((email: string) => {
    localStorage.setItem(CART_EMAIL_KEY, email);
  }, []);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalUsd = items.reduce((s, i) => s + i.price_usd * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, cartId, addItem, removeItem, updateQty,
      clearCart, totalItems, totalUsd, setCustomerEmail,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
