-- SourcingOS V20.3 — durable role compatibility index
-- Additive and safe to rerun.

create index if not exists role_workspaces_legacy_project_id_idx
  on public.role_workspaces(legacy_project_id)
  where legacy_project_id is not null;
