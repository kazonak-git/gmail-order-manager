export type OrderStatus = "new" | "processing" | "shipped" | "done" | "manual";

export interface Attachment {
  filename: string;
  mimeType: string;
  size: number;         // bytes
  attachmentId: string; // Gmail attachment ID (letöltéshez)
}

export interface OrderItem {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ShippingAddress {
  name?: string;
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
}

export interface Order {
  id: string;
  gmail_message_id: string;
  gmail_thread_id?: string;
  order_number?: string;
  order_date?: string;
  customer_name?: string;
  customer_email?: string;
  total_amount?: number;
  currency?: string;
  status: OrderStatus;
  items?: OrderItem[];
  shipping_address?: ShippingAddress;
  payment_method?: string;
  raw_email_subject?: string;
  raw_email_body?: string;
  raw_email_html?: string;
  email_type?: "confirmation" | "invoice" | "other";
  attachments?: Attachment[];
  source_sender?: string;
  parsed_at?: string;
  created_at: string;
  user_id: string;
}

export interface UserFilterSettings {
  id: string;
  user_id: string;
  keywords: string[];
  senders: string[];
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  started_at: string;
  finished_at?: string;
  emails_scanned: number;
  orders_found: number;
  status: "running" | "done" | "error";
  error_message?: string;
}

export interface Database {
  public: {
    Tables: {
      orders: {
        Row: Order;
        Insert: Omit<Order, "id" | "created_at">;
        Update: Partial<Omit<Order, "id" | "created_at">>;
      };
      sync_logs: {
        Row: SyncLog;
        Insert: Omit<SyncLog, "id">;
        Update: Partial<Omit<SyncLog, "id">>;
      };
    };
  };
}
