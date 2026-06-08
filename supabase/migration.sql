-- Orders tábla
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text unique not null,
  gmail_thread_id text,
  order_number text,
  order_date timestamptz,
  customer_name text,
  customer_email text,
  total_amount numeric,
  currency text default 'HUF',
  status text not null default 'new' check (status in ('new', 'processing', 'shipped', 'done', 'manual')),
  items jsonb,
  shipping_address jsonb,
  payment_method text,
  raw_email_subject text,
  raw_email_body text,
  source_sender text,
  parsed_at timestamptz,
  created_at timestamptz not null default now(),
  user_id text not null
);

-- Index a gyors kereséshez
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_order_date_idx on public.orders(order_date desc);
create index if not exists orders_gmail_message_id_idx on public.orders(gmail_message_id);

-- Sync logs tábla
create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  emails_scanned integer not null default 0,
  orders_found integer not null default 0,
  status text not null default 'running' check (status in ('running', 'done', 'error')),
  error_message text,
  user_id text not null
);

create index if not exists sync_logs_user_id_idx on public.sync_logs(user_id);

-- Felhasználónkénti szűrő beállítások (kulcsszavak + feladók)
create table if not exists public.user_filter_settings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  keywords text[] not null default '{}',
  senders  text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_filter_settings_user_id_idx on public.user_filter_settings(user_id);

-- sync_from_date oszlop (YYYY-MM-DD), ha még nem létezik
alter table public.user_filter_settings
  add column if not exists sync_from_date text;

-- Csatolmány metaadatok és nyers HTML tárolása
alter table public.orders
  add column if not exists attachments jsonb,
  add column if not exists raw_email_html text,
  add column if not exists email_type text; -- 'confirmation' | 'invoice' | 'other'
