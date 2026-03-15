create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.pdf_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  content_hash text not null,
  extracted_text text,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, content_hash)
);

create table if not exists public.study_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.pdf_documents(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('summary', 'key_terms', 'study_notes', 'flashcards', 'quiz', 'ask')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, document_id, artifact_type)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
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

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

alter table public.profiles enable row level security;
alter table public.pdf_documents enable row level security;
alter table public.study_artifacts enable row level security;
alter table public.quiz_attempts enable row level security;

create policy "Users can read own profile" on public.profiles
for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
for insert with check (auth.uid() = id);

create policy "Users can manage own pdf documents" on public.pdf_documents
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage own study artifacts" on public.study_artifacts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage own quiz attempts" on public.quiz_attempts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Create a storage bucket named studybuddy-pdfs in the Supabase dashboard or SQL editor.
-- Example:
-- insert into storage.buckets (id, name, public) values ('studybuddy-pdfs', 'studybuddy-pdfs', false)
-- on conflict (id) do nothing;

-- Then add storage policies like:
-- create policy "Users can upload own pdfs" on storage.objects
-- for insert to authenticated with check (bucket_id = 'studybuddy-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "Users can read own pdfs" on storage.objects
-- for select to authenticated using (bucket_id = 'studybuddy-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
