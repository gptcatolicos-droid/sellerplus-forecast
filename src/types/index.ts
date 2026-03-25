// ─────────────────────────────────────────────
// CORE TYPES — La Tienda de Comics
// ─────────────────────────────────────────────

export type ProductStatus = 'published' | 'draft' | 'archived';
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PreventaStatus = 'inactive' | 'active' | 'completed';
export type SupplierSource = 'midtown' | 'panini' | 'ironstudios' | 'amazon' | 'manual';
export type CouponType = 'percentage' | 'fixed' | 'free_shipping';
export type ShippingZone = 'colombia' | 'international';

// ─── PRODUCT ─────────────────────────────────
export interface Product {
  id: string;
  slug: string;
  title: string;
  title_en?: string;
  description: string;
  description_en?: string;
  price_usd: number;           // Your selling price in USD
  price_usd_original?: number; // Supplier price (for display/margin calc)
  price_cop: number;           // Auto-calculated COP (rounded to nearest integer)
  price_old_usd?: number;      // Crossed-out price
  images: ProductImage[];
  category: string;
  supplier: SupplierSource;
  supplier_url?: string;       // Hidden from customers
  supplier_sku?: string;
  stock: number;
  status: ProductStatus;
  // Preventa
  preventa_enabled: boolean;
  preventa_percent: number;    // Default 30
  preventa_launch_date?: string;
  // SEO
  meta_title?: string;
  meta_description?: string;
  seo_keywords?: string[];
  // Metadata
  publisher?: string;
  author?: string;
  year?: number;
  isbn?: string;
  characters?: string[];
  franchise?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;       // AI-generated alt text for SEO
  is_primary: boolean;
  sort_order: number;
}

// ─── ORDER ───────────────────────────────────
export interface Order {
  id: string;
  order_number: string;        // LTC-2026-XXXXXX
  status: OrderStatus;
  customer: Customer;
  items: OrderItem[];
  subtotal_usd: number;
  shipping_usd: number;
  discount_usd: number;
  total_usd: number;
  total_cop: number;
  shipping_zone: ShippingZone;
  shipping_address: ShippingAddress;
  coupon_code?: string;
  payment_id?: string;         // MercadoPago payment ID
  payment_method?: string;
  tracking_number?: string;
  tracking_carrier?: string;
  tracking_notified_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_title: string;
  product_image?: string;
  quantity: number;
  price_usd: number;
  supplier_url?: string;
  is_preventa: boolean;
  preventa_amount_paid?: number;  // Amount paid today (30%)
  preventa_remaining?: number;    // Amount to pay on arrival
}

export interface Customer {
  name: string;
  email: string;
  phone?: string;
  country: string;
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
  country_code: string;
}

// ─── COUPON ──────────────────────────────────
export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;               // % or $ amount
  max_uses?: number;
  uses_count: number;
  min_order_usd?: number;
  expires_at?: string;
  active: boolean;
  created_at: string;
}

// ─── CART ────────────────────────────────────
export interface CartItem {
  product_id: string;
  product: Product;
  quantity: number;
  is_preventa: boolean;        // User chose preventa option
}

export interface Cart {
  items: CartItem[];
  coupon?: Coupon;
  shipping_zone?: ShippingZone;
}

// ─── EXCHANGE RATE ───────────────────────────
export interface ExchangeRate {
  usd_to_cop: number;
  usd_to_mxn: number;
  usd_to_ars: number;
  updated_at: string;
}

// ─── ADMIN ───────────────────────────────────
export interface BulkPriceUpdate {
  type: 'percentage' | 'fixed';
  value: number;
  apply_to: 'all' | 'category' | 'selected';
  category?: string;
  product_ids?: string[];
}

export interface BulkStockUpdate {
  product_id: string;
  new_stock: number;
}

// ─── URL IMPORTER ────────────────────────────
export interface ImportedProduct {
  title: string;
  description: string;
  price_original: number;
  price_original_currency: 'USD' | 'COP';
  images: string[];
  supplier: SupplierSource;
  supplier_url: string;
  supplier_sku?: string;
  publisher?: string;
  author?: string;
  in_stock: boolean;
  franchise?: string;
  characters?: string[];
}

// ─── API RESPONSES ───────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
