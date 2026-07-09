export type PaymentStatus = 'paid' | 'pending' | 'cancelled' | 'failed' | 'unknown';

export type LusopayResource = {
  base_url: string;
  pid: string;
  username: string;
  password: string;
};

export type PaymentFilters = {
  start_date?: string;
  end_date?: string;
  status?: PaymentStatus | string;
  payment_method?: string;
  order_id?: string;
  min_amount?: number;
  max_amount?: number;
  limit?: number;
};

export type NormalizedPayment = {
  order_id: string | null;
  payment_status: PaymentStatus;
  amount: number;
  currency: string;
  payment_method: string | null;
  created_at: string | null;
  paid_at: string | null;
  raw_source: 'lusopay' | 'store_mock' | 'lusopay_mock';
  raw?: unknown;
};

export type StoreOrder = {
  order_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  amount: number;
  currency: string;
  store_status: string;
  normalized_status: PaymentStatus;
  created_at: string;
  payment_method: string | null;
};

export type StoreCustomer = {
  id: string;
  name: string;
  email: string;
};

export type ListPaymentsResult = {
  ok: true;
  count: number;
  total_before_limit: number;
  payments: NormalizedPayment[];
  filters: PaymentFilters;
};

