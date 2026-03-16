create extension if not exists "pgcrypto";

create table if not exists public.pdf_documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  content_hash text not null unique,
  extracted_text text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_artifacts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.pdf_documents(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('summary', 'key_terms', 'study_notes', 'flashcards', 'quiz', 'ask')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id, artifact_type)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.pdf_documents(id) on delete set null,
  question_count integer not null,
  score integer not null,
  total_questions integer not null,
  answers jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pdf_documents_updated_at on public.pdf_documents;
create trigger pdf_documents_updated_at
before update on public.pdf_documents
for each row
execute function public.handle_updated_at();

drop trigger if exists study_artifacts_updated_at on public.study_artifacts;
create trigger study_artifacts_updated_at
before update on public.study_artifacts
for each row
execute function public.handle_updated_at();

-- Create a storage bucket named studybuddy-pdfs in the Supabase dashboard or SQL editor.
-- Example:
-- insert into storage.buckets (id, name, public) values ('studybuddy-pdfs', 'studybuddy-pdfs', false)
-- on conflict (id) do nothing;

-- If you want optional PDF uploads from the browser without user accounts,
-- add anon policies for that bucket in Supabase. Example:
-- create policy "Anon can upload pdfs" on storage.objects
-- for insert to anon with check (bucket_id = 'studybuddy-pdfs');
-- create policy "Anon can read pdfs" on storage.objects
-- for select to anon using (bucket_id = 'studybuddy-pdfs');
