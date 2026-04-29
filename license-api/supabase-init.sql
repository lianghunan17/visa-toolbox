create extension if not exists pgcrypto;

create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text unique not null,
  product_name text not null default '签证工具箱',
  order_id text,
  customer_email text not null,
  customer_name text,
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled', 'expired')),
  activation_limit integer not null default 1,
  activation_usage integer not null default 0,
  device_id text,
  device_name text,
  auth_token text,
  activated_at timestamptz,
  expires_at timestamptz,
  disabled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_licenses_license_key on licenses(license_key);
create index if not exists idx_licenses_customer_email on licenses(customer_email);
create index if not exists idx_licenses_auth_token on licenses(auth_token);
create index if not exists idx_licenses_status on licenses(status);

create table if not exists license_events (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  event_type text not null,
  event_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_license_events_license_id on license_events(license_id);
create index if not exists idx_license_events_event_type on license_events(event_type);
create index if not exists idx_license_events_created_at on license_events(created_at desc);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists feedback_entries (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'full' check (mode in ('full', 'survey-gate')),
  helpfulness text,
  tool_used text,
  value_focus jsonb,
  main_issue text,
  wanted_features jsonb,
  pricing_preference text,
  recommendation text,
  extra_comment text,
  question_key text,
  answer text,
  source_tool text,
  client_tag text,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_entries_created_at on feedback_entries(created_at desc);
create index if not exists idx_feedback_entries_mode on feedback_entries(mode);
create index if not exists idx_feedback_entries_tool_used on feedback_entries(tool_used);

create table if not exists app_runtime_config (
  config_key text primary key,
  config_value jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

insert into app_runtime_config (config_key, config_value)
values (
  'site_mode',
  jsonb_build_object(
    'mode', 'beta',
    'theme', 'future',
    'title', '签证工具箱',
    'subtitle', '把常用的签证与在留判断工具放进一个更轻、更快、更未来感的入口。',
    'announcement', '当前为内测版，默认免费开放，用来快速验证流程、内容和页面体验。',
    'ctaLabel', '开始体验',
    'requireLicenseInPaid', true,
    'surveyGateEnabled', true
  )
)
on conflict (config_key) do nothing;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_licenses_updated_at on licenses;
create trigger trg_licenses_updated_at
before update on licenses
for each row
execute function set_updated_at();

drop trigger if exists trg_admin_users_updated_at on admin_users;
create trigger trg_admin_users_updated_at
before update on admin_users
for each row
execute function set_updated_at();
