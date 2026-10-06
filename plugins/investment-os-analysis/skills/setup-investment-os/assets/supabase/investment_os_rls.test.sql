-- Run in a disposable/local Supabase test environment.
begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

select ok((select relrowsecurity from pg_class where oid = 'public.ios_companies'::regclass), 'RLS enabled on ios_companies');
select ok((select relrowsecurity from pg_class where oid = 'public.ios_portfolio_snapshots'::regclass), 'RLS enabled on ios_portfolio_snapshots');
select ok((select relrowsecurity from pg_class where oid = 'public.ios_analysis_runs'::regclass), 'RLS enabled on ios_analysis_runs');
select ok((select relrowsecurity from pg_class where oid = 'public.ios_analyses'::regclass), 'RLS enabled on ios_analyses');
select ok((select relrowsecurity from pg_class where oid = 'public.ios_handoffs'::regclass), 'RLS enabled on ios_handoffs');
select ok((select relrowsecurity from pg_class where oid = 'public.ios_portfolio_positions'::regclass), 'RLS enabled on ios_portfolio_positions');
select ok((select relrowsecurity from pg_class where oid = 'public.ios_sources'::regclass), 'RLS enabled on ios_sources');
select ok((select relrowsecurity from pg_class where oid = 'public.ios_current_analyses'::regclass), 'RLS enabled on ios_current_analyses');

select ok(not has_table_privilege('anon', 'public.ios_companies', 'select'), 'anon cannot select companies');
select ok(not has_table_privilege('anon', 'public.ios_analyses', 'insert'), 'anon cannot insert analyses');
select ok(not has_table_privilege('anon', 'public.ios_handoffs', 'update'), 'anon cannot update handoffs');
select ok(not has_table_privilege('anon', 'public.ios_portfolio_positions', 'delete'), 'anon cannot delete positions');

select ok(has_table_privilege('authenticated', 'public.ios_companies', 'select'), 'authenticated can select companies through RLS');
select ok(has_table_privilege('authenticated', 'public.ios_analyses', 'insert'), 'authenticated can insert analyses through RLS');
select ok(has_table_privilege('authenticated', 'public.ios_handoffs', 'update'), 'authenticated can update handoffs through RLS');
select ok(has_table_privilege('authenticated', 'public.ios_portfolio_positions', 'delete'), 'authenticated can delete positions through RLS');

select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'ios_companies'), 4, 'companies has four operation policies');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'ios_analyses'), 4, 'analyses has four operation policies');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'ios_handoffs'), 4, 'handoffs has four operation policies');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'ios_current_analyses'), 4, 'current analyses has four operation policies');

select * from finish();
rollback;
