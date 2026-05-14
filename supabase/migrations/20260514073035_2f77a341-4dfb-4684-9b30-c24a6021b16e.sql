
-- Roles enum + tables
create type public.app_role as enum ('admin', 'sales', 'service', 'viewer');
create type public.deal_stage as enum ('prospecting','bant','discovery','solution_cpq','negotiation','closed_won','handover');
create type public.deal_status as enum ('open','won','lost');
create type public.maintenance_status as enum ('scheduled','in_progress','completed','overdue');
create type public.quotation_status as enum ('draft','sent','accepted','rejected','expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

-- Security definer role check
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = 'admin')
$$;

create or replace function public.can_edit_sales(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role in ('admin','sales'))
$$;

create or replace function public.can_edit_service(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role in ('admin','service'))
$$;

-- CRM Tables
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  size text,
  website text,
  status text not null default 'active',
  lead_score int not null default 0,
  ai_summary text,
  annual_revenue numeric,
  notes text,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address text,
  city text,
  country text,
  site_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  full_name text not null,
  job_title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  asset_type text,
  serial_number text unique,
  manufacturer text,
  model text,
  load_capacity_kg numeric,
  install_date date,
  warranty_expiry date,
  maintenance_interval_days int default 180,
  last_maintenance_date date,
  next_maintenance_date date,
  drawing_url text,
  status text not null default 'operational',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company_id uuid references public.companies(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  stage deal_stage not null default 'prospecting',
  status deal_status not null default 'open',
  value numeric not null default 0,
  currency text not null default 'USD',
  probability int not null default 10,
  expected_close_date date,
  position int not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maintenance_orders (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  title text not null,
  description text,
  scheduled_date date not null,
  completed_date date,
  status maintenance_status not null default 'scheduled',
  technician_id uuid references auth.users(id) on delete set null,
  cost numeric default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  deal_id uuid references public.deals(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  status quotation_status not null default 'draft',
  issue_date date not null default current_date,
  expiry_date date,
  subtotal numeric not null default 0,
  tax_rate numeric not null default 0.1,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  currency text not null default 'USD',
  line_items jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  description text,
  company_id uuid references public.companies(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_companies_updated before update on public.companies for each row execute function public.set_updated_at();
create trigger trg_sites_updated before update on public.sites for each row execute function public.set_updated_at();
create trigger trg_contacts_updated before update on public.contacts for each row execute function public.set_updated_at();
create trigger trg_assets_updated before update on public.assets for each row execute function public.set_updated_at();
create trigger trg_deals_updated before update on public.deals for each row execute function public.set_updated_at();
create trigger trg_maint_updated before update on public.maintenance_orders for each row execute function public.set_updated_at();
create trigger trg_quotes_updated before update on public.quotations for each row execute function public.set_updated_at();

-- Auto profile + viewer role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  insert into public.user_roles (user_id, role) values (new.id, 'viewer');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.companies enable row level security;
alter table public.sites enable row level security;
alter table public.contacts enable row level security;
alter table public.assets enable row level security;
alter table public.deals enable row level security;
alter table public.maintenance_orders enable row level security;
alter table public.quotations enable row level security;
alter table public.activities enable row level security;

-- Profiles policies
create policy "profiles_self_select" on public.profiles for select to authenticated using (true);
create policy "profiles_self_update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles_self_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- user_roles policies
create policy "roles_view_all" on public.user_roles for select to authenticated using (true);
create policy "roles_admin_manage" on public.user_roles for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Helper: standard "view all + sales-edit + admin-delete" policies
-- companies
create policy "companies_view" on public.companies for select to authenticated using (true);
create policy "companies_insert" on public.companies for insert to authenticated with check (public.can_edit_sales(auth.uid()));
create policy "companies_update" on public.companies for update to authenticated using (public.can_edit_sales(auth.uid()));
create policy "companies_delete" on public.companies for delete to authenticated using (public.is_admin(auth.uid()));

-- sites
create policy "sites_view" on public.sites for select to authenticated using (true);
create policy "sites_insert" on public.sites for insert to authenticated with check (public.can_edit_sales(auth.uid()));
create policy "sites_update" on public.sites for update to authenticated using (public.can_edit_sales(auth.uid()));
create policy "sites_delete" on public.sites for delete to authenticated using (public.is_admin(auth.uid()));

-- contacts
create policy "contacts_view" on public.contacts for select to authenticated using (true);
create policy "contacts_insert" on public.contacts for insert to authenticated with check (public.can_edit_sales(auth.uid()));
create policy "contacts_update" on public.contacts for update to authenticated using (public.can_edit_sales(auth.uid()));
create policy "contacts_delete" on public.contacts for delete to authenticated using (public.is_admin(auth.uid()));

-- deals
create policy "deals_view" on public.deals for select to authenticated using (true);
create policy "deals_insert" on public.deals for insert to authenticated with check (public.can_edit_sales(auth.uid()));
create policy "deals_update" on public.deals for update to authenticated using (public.can_edit_sales(auth.uid()));
create policy "deals_delete" on public.deals for delete to authenticated using (public.is_admin(auth.uid()));

-- quotations
create policy "quotations_view" on public.quotations for select to authenticated using (true);
create policy "quotations_insert" on public.quotations for insert to authenticated with check (public.can_edit_sales(auth.uid()));
create policy "quotations_update" on public.quotations for update to authenticated using (public.can_edit_sales(auth.uid()));
create policy "quotations_delete" on public.quotations for delete to authenticated using (public.is_admin(auth.uid()));

-- assets (service + admin)
create policy "assets_view" on public.assets for select to authenticated using (true);
create policy "assets_insert" on public.assets for insert to authenticated with check (public.can_edit_service(auth.uid()) or public.can_edit_sales(auth.uid()));
create policy "assets_update" on public.assets for update to authenticated using (public.can_edit_service(auth.uid()) or public.can_edit_sales(auth.uid()));
create policy "assets_delete" on public.assets for delete to authenticated using (public.is_admin(auth.uid()));

-- maintenance
create policy "maint_view" on public.maintenance_orders for select to authenticated using (true);
create policy "maint_insert" on public.maintenance_orders for insert to authenticated with check (public.can_edit_service(auth.uid()));
create policy "maint_update" on public.maintenance_orders for update to authenticated using (public.can_edit_service(auth.uid()));
create policy "maint_delete" on public.maintenance_orders for delete to authenticated using (public.is_admin(auth.uid()));

-- activities (anyone authed can write own)
create policy "activities_view" on public.activities for select to authenticated using (true);
create policy "activities_insert" on public.activities for insert to authenticated with check (auth.uid() = user_id);
create policy "activities_delete" on public.activities for delete to authenticated using (public.is_admin(auth.uid()));

-- Indexes
create index on public.sites(company_id);
create index on public.contacts(company_id);
create index on public.assets(site_id);
create index on public.assets(company_id);
create index on public.deals(stage);
create index on public.deals(company_id);
create index on public.maintenance_orders(asset_id);
create index on public.maintenance_orders(scheduled_date);
create index on public.quotations(deal_id);
create index on public.activities(company_id);
