-- V36.12 contact-channel truth. Existing rows remain valid with null subtype.
alter table if exists public.candidate_contacts
  add column if not exists contact_kind text,
  add column if not exists ownership_confidence text,
  add column if not exists deliverability text,
  add column if not exists provider_status_raw text,
  add column if not exists observed_at timestamptz;

create index if not exists candidate_contacts_candidate_kind_idx
  on public.candidate_contacts(candidate_id, contact_kind)
  where contact_kind is not null;

comment on column public.candidate_contacts.contact_kind is
  'Provider-supported channel semantics such as work_email or mobile_phone. Null means unknown; SourcingOS must not infer personal/mobile from syntax alone.';
comment on column public.candidate_contacts.deliverability is
  'Technical channel status only. Never implies outreach permission.';
