-- Investment OS external persistence schema v1.0.0
-- Review before execution. This file never runs automatically.

create table if not exists public.ios_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  ticker text not null,
  exchange text not null default '',
  currency text not null,
  aliases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker, exchange),
  unique (id, user_id)
);

create table if not exists public.ios_portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  base_currency text not null,
  cash_by_account jsonb not null default '{}'::jsonb,
  total_value numeric,
  source text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.ios_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_key text not null,
  company_id uuid not null,
  portfolio_snapshot_id uuid,
  execution_profile text not null check (execution_profile in ('conversation', 'notion-investment-os', 'external-database')),
  requested_modules text[] not null default '{}'::text[],
  analytical_status text not null default 'not_started' check (analytical_status in ('not_started', 'in_progress', 'complete', 'partial', 'failed')),
  persistence_status text not null default 'pending' check (persistence_status in ('not_required', 'pending', 'published', 'verified', 'failed')),
  checkpoint_module text,
  framework_versions jsonb not null default '{}'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, run_key),
  unique (id, user_id),
  foreign key (company_id, user_id) references public.ios_companies(id, user_id) on delete cascade,
  foreign key (portfolio_snapshot_id, user_id) references public.ios_portfolio_snapshots(id, user_id) on delete restrict
);

create table if not exists public.ios_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  run_id uuid not null,
  module text not null check (module in ('business', 'valuation', 'short', 'portfolio', 'memo_cio')),
  title text not null,
  analysis_date date not null,
  version integer not null check (version > 0),
  status text not null check (status in ('draft', 'validated', 'superseded')),
  source_freshness text not null check (source_freshness in ('current', 'stale', 'unknown')),
  verdict text,
  score numeric check (score is null or (score >= 0 and score <= 100)),
  check (module in ('business', 'valuation') or score is null),
  confidence text check (confidence is null or confidence in ('low', 'medium', 'high')),
  evidence_gaps jsonb not null default '[]'::jsonb,
  handoff_summary jsonb not null default '{}'::jsonb,
  content_markdown text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id, module, version),
  unique (user_id, run_id, module, version),
  unique (id, user_id, company_id, module),
  foreign key (company_id, user_id) references public.ios_companies(id, user_id) on delete cascade,
  foreign key (run_id, user_id) references public.ios_analysis_runs(id, user_id) on delete cascade
);

create table if not exists public.ios_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  run_id uuid not null,
  source_module text not null check (source_module in ('business', 'valuation', 'short', 'portfolio', 'memo_cio')),
  contract_version text not null,
  payload jsonb not null,
  validation_status text not null check (validation_status in ('validated', 'partial', 'failed')),
  created_at timestamptz not null default now(),
  unique (user_id, run_id, source_module),
  foreign key (company_id, user_id) references public.ios_companies(id, user_id) on delete cascade,
  foreign key (run_id, user_id) references public.ios_analysis_runs(id, user_id) on delete cascade
);

create table if not exists public.ios_portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid not null,
  company_id uuid,
  ticker text not null,
  account text not null,
  instrument_type text not null default 'stock',
  quantity numeric,
  market_price numeric,
  market_value numeric not null,
  currency text not null,
  average_cost numeric,
  target_weight numeric,
  maximum_weight numeric,
  lookthrough jsonb not null default '{}'::jsonb,
  derivative_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (snapshot_id, user_id) references public.ios_portfolio_snapshots(id, user_id) on delete cascade,
  foreign key (company_id, user_id) references public.ios_companies(id, user_id) on delete restrict
);

create table if not exists public.ios_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid not null,
  url text not null,
  title text,
  publisher text,
  published_at timestamptz,
  accessed_at timestamptz not null default now(),
  source_type text,
  is_primary boolean not null default false,
  foreign key (analysis_id, user_id) references public.ios_analyses(id, user_id) on delete cascade
);

create table if not exists public.ios_current_analyses (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  module text not null check (module in ('business', 'valuation', 'short', 'portfolio', 'memo_cio')),
  analysis_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, company_id, module),
  foreign key (analysis_id, user_id, company_id, module)
    references public.ios_analyses(id, user_id, company_id, module) on delete cascade
);

create index if not exists ios_companies_user_idx on public.ios_companies(user_id);
create index if not exists ios_runs_user_company_idx on public.ios_analysis_runs(user_id, company_id);
create index if not exists ios_analyses_user_company_module_idx on public.ios_analyses(user_id, company_id, module, analysis_date desc);
create index if not exists ios_handoffs_user_run_idx on public.ios_handoffs(user_id, run_id);
create index if not exists ios_snapshots_user_date_idx on public.ios_portfolio_snapshots(user_id, snapshot_date desc);
create index if not exists ios_positions_user_snapshot_idx on public.ios_portfolio_positions(user_id, snapshot_id);
create index if not exists ios_sources_user_analysis_idx on public.ios_sources(user_id, analysis_id);

alter table public.ios_companies enable row level security;
alter table public.ios_portfolio_snapshots enable row level security;
alter table public.ios_analysis_runs enable row level security;
alter table public.ios_analyses enable row level security;
alter table public.ios_handoffs enable row level security;
alter table public.ios_portfolio_positions enable row level security;
alter table public.ios_sources enable row level security;
alter table public.ios_current_analyses enable row level security;

revoke all on table public.ios_companies from anon, authenticated;
revoke all on table public.ios_portfolio_snapshots from anon, authenticated;
revoke all on table public.ios_analysis_runs from anon, authenticated;
revoke all on table public.ios_analyses from anon, authenticated;
revoke all on table public.ios_handoffs from anon, authenticated;
revoke all on table public.ios_portfolio_positions from anon, authenticated;
revoke all on table public.ios_sources from anon, authenticated;
revoke all on table public.ios_current_analyses from anon, authenticated;

grant select, insert, update, delete on table public.ios_companies to authenticated;
grant select, insert, update, delete on table public.ios_portfolio_snapshots to authenticated;
grant select, insert, update, delete on table public.ios_analysis_runs to authenticated;
grant select, insert, update, delete on table public.ios_analyses to authenticated;
grant select, insert, update, delete on table public.ios_handoffs to authenticated;
grant select, insert, update, delete on table public.ios_portfolio_positions to authenticated;
grant select, insert, update, delete on table public.ios_sources to authenticated;
grant select, insert, update, delete on table public.ios_current_analyses to authenticated;

create policy "ios_companies_select_own" on public.ios_companies for select to authenticated using ((select auth.uid()) = user_id);
create policy "ios_companies_insert_own" on public.ios_companies for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ios_companies_update_own" on public.ios_companies for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ios_companies_delete_own" on public.ios_companies for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ios_snapshots_select_own" on public.ios_portfolio_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy "ios_snapshots_insert_own" on public.ios_portfolio_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ios_snapshots_update_own" on public.ios_portfolio_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ios_snapshots_delete_own" on public.ios_portfolio_snapshots for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ios_runs_select_own" on public.ios_analysis_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy "ios_runs_insert_own" on public.ios_analysis_runs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ios_runs_update_own" on public.ios_analysis_runs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ios_runs_delete_own" on public.ios_analysis_runs for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ios_analyses_select_own" on public.ios_analyses for select to authenticated using ((select auth.uid()) = user_id);
create policy "ios_analyses_insert_own" on public.ios_analyses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ios_analyses_update_own" on public.ios_analyses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ios_analyses_delete_own" on public.ios_analyses for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ios_handoffs_select_own" on public.ios_handoffs for select to authenticated using ((select auth.uid()) = user_id);
create policy "ios_handoffs_insert_own" on public.ios_handoffs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ios_handoffs_update_own" on public.ios_handoffs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ios_handoffs_delete_own" on public.ios_handoffs for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ios_positions_select_own" on public.ios_portfolio_positions for select to authenticated using ((select auth.uid()) = user_id);
create policy "ios_positions_insert_own" on public.ios_portfolio_positions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ios_positions_update_own" on public.ios_portfolio_positions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ios_positions_delete_own" on public.ios_portfolio_positions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ios_sources_select_own" on public.ios_sources for select to authenticated using ((select auth.uid()) = user_id);
create policy "ios_sources_insert_own" on public.ios_sources for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ios_sources_update_own" on public.ios_sources for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ios_sources_delete_own" on public.ios_sources for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ios_current_select_own" on public.ios_current_analyses for select to authenticated using ((select auth.uid()) = user_id);
create policy "ios_current_insert_own" on public.ios_current_analyses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ios_current_update_own" on public.ios_current_analyses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ios_current_delete_own" on public.ios_current_analyses for delete to authenticated using ((select auth.uid()) = user_id);
