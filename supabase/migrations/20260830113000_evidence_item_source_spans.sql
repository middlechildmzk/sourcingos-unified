-- SourcingOS V32 — traceable evidence source spans.
-- Additive only. Existing RLS, owner scoping, grants, and delete cascades remain
-- unchanged. A span is useful only when the server revalidates it against the
-- linked source_profiles.raw_text before exposing it as an EvidenceClaim.

alter table public.evidence_items
  add column if not exists span_start integer,
  add column if not exists span_end integer,
  add column if not exists span_text text,
  add column if not exists source_text_ref text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'evidence_items_source_span_complete'
       and conrelid = 'public.evidence_items'::regclass
  ) then
    alter table public.evidence_items
      add constraint evidence_items_source_span_complete
      check (
        (span_start is null and span_end is null and span_text is null and source_text_ref is null)
        or
        (
          span_start is not null
          and span_end is not null
          and span_text is not null
          and source_text_ref is not null
          and source_profile_id is not null
          and span_start >= 0
          and span_end > span_start
        )
      );
  end if;
end $$;

comment on column public.evidence_items.span_start is
  'Zero-based source-text offset captured at evidence ingestion. Revalidated server-side before requirement use.';
comment on column public.evidence_items.span_end is
  'Exclusive source-text offset captured at evidence ingestion. Revalidated server-side before requirement use.';
comment on column public.evidence_items.span_text is
  'Exact source substring at span_start:span_end. Never treated as valid until compared with stored source text.';
comment on column public.evidence_items.source_text_ref is
  'Logical reference to the stored source text, currently source_profile:<uuid>:raw_text.';
