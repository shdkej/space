create table if not exists public.image_annotations (
  image_key text primary key,
  note text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.image_annotations enable row level security;

create table if not exists public.image_topics (
  image_key text primary key,
  topic text not null,
  tags jsonb not null default '[]'::jsonb,
  summary text not null default '',
  confidence numeric(4,3),
  source text not null default 'agent-vision',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.image_topics
  add column if not exists subject_tags jsonb not null default '[]'::jsonb,
  add column if not exists judgment_tags jsonb not null default '[]'::jsonb;

alter table public.image_topics enable row level security;
