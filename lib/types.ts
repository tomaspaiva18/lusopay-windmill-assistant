export type PaymentStatus = 'paid' | 'pending' | 'cancelled' | 'failed' | 'unknown';

export interface MerchantContext {
  merchant_id: string;
  merchant_name: string;
  lusopay: {
    pid: string;
    username: string;
    password: string;
    environment: 'test' | 'prod';
  };
  store?: {
    platform: 'woocommerce' | 'shopify' | 'prestashop' | 'custom' | 'mock';
    credentials?: Record<string, unknown>;
  };
}

export interface NormalizedPayment {
  payment_id: string | null;
  order_id: string | null;
  payment_status: PaymentStatus;
  amount: number | null;
  currency: string;
  payment_method: string | null;
  payment_link?: string | null;
  link_status?: string | null;
  created_at: string | null;
  paid_at: string | null;
  raw_source: 'lusopay';
  raw?: unknown;
}

export interface StoreOrder {
  order_id: string;
  customer_id: string;
  amount: number;
  currency: string;
  store_status: string;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
  payment_method?: string | null;
}

export interface StoreCustomer {
  id: string;
  name: string;
  email: string;
}

export interface ReconciliationIssue {
  order_id: string;
  issue: 'only_in_lusopay' | 'only_in_store' | 'status_mismatch' | 'amount_mismatch';
  store_status?: string | null;
  lusopay_status?: string | null;
  store_amount?: number | null;
  lusopay_amount?: number | null;
}

export interface PaymentFilters {
  start_date?: string;
  end_date?: string;
  status?: string;
  payment_method?: string;
  order_id?: string;
}
