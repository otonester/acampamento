-- Gestor de Acampamento: esquema, segurança (RLS) e dados de demonstração.
-- Cada evento pertence ao organizador autenticado. Nada é acessível sem login.

-- ============================================================
-- Tabelas
-- ============================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  location text not null default '',
  start_date date not null,
  end_date date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index events_owner_idx on public.events (owner_id);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  display_name text not null check (length(trim(display_name)) > 0),
  categories text[] not null default '{}', -- uma pessoa pode ter mais de uma função
  phone text not null default '',
  guardian text not null default '',
  notes text not null default '',
  status text not null default 'confirmado' check (status in ('confirmado', 'pendente', 'cancelado')),
  created_at timestamptz not null default now(),
  unique (event_id, id)
);
create index participants_event_idx on public.participants (event_id);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  materials text not null default '',
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  responsible_participant_id uuid,
  responsible_name text not null default '',
  notes text not null default '',
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, id),
  foreign key (event_id, responsible_participant_id)
    references public.participants (event_id, id) on delete set null (responsible_participant_id)
);
create index games_event_idx on public.games (event_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  activity_date date,
  start_time time,
  duration_minutes integer not null default 0 check (duration_minutes >= 0), -- zero = aviso ou marco
  responsible_participant_id uuid,
  responsible_name text not null default '',
  description text not null default '',
  category text not null default 'Outra',
  requirements text not null default '',
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  allow_overlap boolean not null default false, -- simultânea de propósito: não sinaliza conflito
  game_id uuid,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (start_time is null or activity_date is not null),
  foreign key (event_id, responsible_participant_id)
    references public.participants (event_id, id) on delete set null (responsible_participant_id),
  foreign key (event_id, game_id)
    references public.games (event_id, id) on delete set null (game_id)
);
create index activities_event_idx on public.activities (event_id, activity_date, start_time, sort_order);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  meal_date date not null,
  meal_type text not null check (meal_type in ('cafe_manha', 'almoco', 'cafe_tarde', 'jantar', 'lanche')),
  meal_time time,
  description text not null default '',
  responsible_participant_id uuid,
  responsible_name text not null default '',
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, id),
  foreign key (event_id, responsible_participant_id)
    references public.participants (event_id, id) on delete set null (responsible_participant_id)
);
create index meals_event_idx on public.meals (event_id, meal_date);

-- meal_id nulo = alimento ou bebida geral, sem refeição específica.
create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  meal_id uuid,
  name text not null check (length(trim(name)) > 0),
  quantity numeric check (quantity is null or quantity >= 0),
  unit text not null default '',
  kind text not null default 'alimento' check (kind in ('alimento', 'bebida')),
  sort_order integer not null default 0,
  foreign key (event_id, meal_id) references public.meals (event_id, id) on delete cascade
);
create index meal_items_event_idx on public.meal_items (event_id);
create index meal_items_meal_idx on public.meal_items (meal_id);

-- Linha da lista consolidada marcada como comprada (chave = nome normalizado).
create table public.shopping_checks (
  event_id uuid not null references public.events (id) on delete cascade,
  item_key text not null,
  primary key (event_id, item_key)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  direction text not null check (direction in ('ida', 'volta')),
  driver_name text not null check (length(trim(driver_name)) > 0), -- motorista pode ser externo
  driver_participant_id uuid,
  vehicle text not null default '',
  seats integer not null default 4 check (seats >= 0),
  depart_time time,
  depart_place text not null default '',
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, id),
  foreign key (event_id, driver_participant_id)
    references public.participants (event_id, id) on delete set null (driver_participant_id)
);
create index vehicles_event_idx on public.vehicles (event_id, direction);

-- Sem unicidade por sentido: nomes repetidos são sinalizados na tela, nunca removidos automaticamente.
create table public.ride_passengers (
  event_id uuid not null references public.events (id) on delete cascade,
  vehicle_id uuid not null,
  participant_id uuid not null,
  primary key (vehicle_id, participant_id),
  foreign key (event_id, vehicle_id) references public.vehicles (event_id, id) on delete cascade,
  foreign key (event_id, participant_id) references public.participants (event_id, id) on delete cascade
);
create index ride_passengers_event_idx on public.ride_passengers (event_id);
create index ride_passengers_participant_idx on public.ride_passengers (participant_id);

-- ============================================================
-- Segurança: somente o dono do evento lê e altera os dados
-- ============================================================

create function public.is_event_owner(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.owner_id = (select auth.uid())
  );
$$;

alter table public.events enable row level security;
create policy "Dono gerencia seus eventos" on public.events
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['participants','games','activities','meals','meal_items','shopping_checks','vehicles','ride_passengers']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Dono do evento gerencia" on public.%I for all to authenticated
         using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id))', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ============================================================
-- Atualização em lote dos horários (reordenar e recalcular)
-- ============================================================

create function public.bulk_update_activities(p_event_id uuid, p_updates jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.activities a
     set activity_date = u.activity_date,
         start_time = u.start_time,
         sort_order = u.sort_order
    from jsonb_to_recordset(p_updates)
         as u(id uuid, activity_date date, start_time time, sort_order integer)
   where a.id = u.id and a.event_id = p_event_id;
$$;

-- ============================================================
-- Duplicar um evento para um novo acampamento
-- Copia tudo com datas deslocadas e volta os status ao início.
-- ============================================================

create function public.duplicate_event(p_source uuid, p_name text, p_start_date date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  src public.events;
  v_new uuid := gen_random_uuid();
  v_shift integer;
  r record;
  v_id uuid;
  pmap jsonb := '{}';
  gmap jsonb := '{}';
  mmap jsonb := '{}';
  vmap jsonb := '{}';
begin
  select * into src from public.events where id = p_source;
  if not found then
    raise exception 'Evento não encontrado';
  end if;
  v_shift := p_start_date - src.start_date;

  insert into public.events (id, name, location, start_date, end_date, notes)
  values (v_new, p_name, src.location, p_start_date, src.end_date + v_shift, src.notes);

  for r in select * from public.participants where event_id = p_source loop
    insert into public.participants (event_id, full_name, display_name, categories, phone, guardian, notes, status)
    values (v_new, r.full_name, r.display_name, r.categories, r.phone, r.guardian, r.notes, 'pendente')
    returning id into v_id;
    pmap := pmap || jsonb_build_object(r.id::text, v_id);
  end loop;

  for r in select * from public.games where event_id = p_source loop
    insert into public.games (event_id, name, description, materials, duration_minutes, responsible_participant_id, responsible_name, notes, done, sort_order)
    values (v_new, r.name, r.description, r.materials, r.duration_minutes,
            (pmap ->> r.responsible_participant_id::text)::uuid, r.responsible_name, r.notes, false, r.sort_order)
    returning id into v_id;
    gmap := gmap || jsonb_build_object(r.id::text, v_id);
  end loop;

  insert into public.activities (event_id, title, activity_date, start_time, duration_minutes, responsible_participant_id, responsible_name, description, category, requirements, status, allow_overlap, game_id, sort_order)
  select v_new, a.title, a.activity_date + v_shift, a.start_time, a.duration_minutes,
         (pmap ->> a.responsible_participant_id::text)::uuid, a.responsible_name, a.description, a.category, a.requirements,
         'pendente', a.allow_overlap, (gmap ->> a.game_id::text)::uuid, a.sort_order
    from public.activities a where a.event_id = p_source;

  for r in select * from public.meals where event_id = p_source loop
    insert into public.meals (event_id, meal_date, meal_type, meal_time, description, responsible_participant_id, responsible_name, notes, sort_order)
    values (v_new, r.meal_date + v_shift, r.meal_type, r.meal_time, r.description,
            (pmap ->> r.responsible_participant_id::text)::uuid, r.responsible_name, r.notes, r.sort_order)
    returning id into v_id;
    mmap := mmap || jsonb_build_object(r.id::text, v_id);
  end loop;

  insert into public.meal_items (event_id, meal_id, name, quantity, unit, kind, sort_order)
  select v_new, (mmap ->> i.meal_id::text)::uuid, i.name, i.quantity, i.unit, i.kind, i.sort_order
    from public.meal_items i where i.event_id = p_source;

  for r in select * from public.vehicles where event_id = p_source loop
    insert into public.vehicles (event_id, direction, driver_name, driver_participant_id, vehicle, seats, depart_time, depart_place, notes, sort_order)
    values (v_new, r.direction, r.driver_name, (pmap ->> r.driver_participant_id::text)::uuid, r.vehicle, r.seats, r.depart_time, r.depart_place, r.notes, r.sort_order)
    returning id into v_id;
    vmap := vmap || jsonb_build_object(r.id::text, v_id);
  end loop;

  insert into public.ride_passengers (event_id, vehicle_id, participant_id)
  select v_new, (vmap ->> rp.vehicle_id::text)::uuid, (pmap ->> rp.participant_id::text)::uuid
    from public.ride_passengers rp where rp.event_id = p_source;

  return v_new;
end;
$$;

-- ============================================================
-- Evento de demonstração, editável, baseado nos exemplos iniciais
-- ============================================================

create function public.create_demo_event()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event uuid := gen_random_uuid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_sat date;
  v_sun date;
  v_meal uuid;
  v_vehicle uuid;
  p record;
  n text;
  i integer;
begin
  -- Próximo sábado depois de hoje.
  v_sat := v_today + (((6 - extract(dow from v_today)::integer + 7) % 7) + case when extract(dow from v_today) = 6 then 7 else 0 end);
  v_sun := v_sat + 1;

  insert into public.events (id, name, location, start_date, end_date)
  values (v_event, 'Acampamento de Desbravadores', 'Local a definir', v_sat, v_sun);

  -- Participantes. Quem aparece em duas categorias nos exemplos fica em um só registro, marcado para revisão.
  insert into public.participants (event_id, full_name, display_name, categories, notes) values
    (v_event, 'Gustavo', 'Gustavo', array['Conselheiro'], ''),
    (v_event, 'Sergio', 'Sergio', array['Conselheiro'], ''),
    (v_event, 'Daniel', 'Daniel', array['Conselheiro','Companheiro'], 'Revisar: aparece como Conselheiro e Companheiro nos dados iniciais.'),
    (v_event, 'Brian', 'Brian', array['Amigo','Companheiro'], 'Revisar: aparece como Amigo e Companheiro nos dados iniciais.'),
    (v_event, 'Nicolas', 'Nicolas', array['Amigo'], ''),
    (v_event, 'Pedro', 'Pedro', array['Amigo'], ''),
    (v_event, 'Antonio', 'Antonio', array['Companheiro'], ''),
    (v_event, 'Isaque', 'Isaque', array['Companheiro'], ''),
    (v_event, 'Geovane', 'Geovane', array['Companheiro'], ''),
    (v_event, 'Cauã', 'Cauã', array['Companheiro'], '');

  -- Cronograma de sábado.
  insert into public.activities (event_id, title, activity_date, start_time, duration_minutes, responsible_participant_id, responsible_name, category, description, sort_order)
  values
    (v_event, 'Chegada ao acampamento', v_sat, '08:00', 30, null, 'Pais', 'Logística', '', 10),
    (v_event, 'Abertura e recados', v_sat, '08:30', 20, (select id from public.participants where event_id = v_event and display_name = 'Gustavo'), '', 'Logística', '', 20),
    (v_event, 'Instrução de Excursionismo Pedestre com Mochila — Parte 1', v_sat, '08:50', 40, null, '', 'Instrução', '', 30),
    (v_event, 'Organização das mochilas', v_sat, '09:30', 15, null, '', 'Logística', '', 40),
    (v_event, 'Saída para caminhada', v_sat, '09:45', 0, null, '', 'Aviso ou marco', '', 50),
    (v_event, 'Caminhada de 8 km', v_sat, '09:45', 120, null, '', 'Caminhada', 'Duração estimada até a chegada das 11:45. Revise se necessário.', 60),
    (v_event, 'Pausa simples', v_sat, '10:15', 15, null, '', 'Pausa', '', 70),
    (v_event, 'Pausa maior para alimentação', v_sat, '10:15', 90, null, '', 'Pausa', '', 80),
    (v_event, 'Chegada da caminhada', v_sat, '11:45', 30, null, '', 'Caminhada', '', 90),
    (v_event, 'Tempo livre', v_sat, '12:15', 60, null, '', 'Recreação', '', 100);

  -- Sem horário: seção "A programar".
  insert into public.activities (event_id, title, category, sort_order) values
    (v_event, 'Instrução de Excursionismo Pedestre com Mochila — Parte 2', 'Instrução', 10),
    (v_event, 'Especialidade de Pacificador', 'Especialidade', 20),
    (v_event, 'Completar especialidade de Arte de Acampar', 'Especialidade', 30);

  -- Cardápio.
  insert into public.meals (event_id, meal_date, meal_type, description, sort_order)
  values (v_event, v_sat, 'almoco', 'A definir', 10);

  insert into public.meals (event_id, meal_date, meal_type, description, sort_order)
  values (v_event, v_sat, 'cafe_tarde', 'Pão, bolo, frutas, queijo e manteiga', 20)
  returning id into v_meal;
  i := 0;
  foreach n in array array['Pão','Bolo','Frutas','Queijo','Manteiga'] loop
    i := i + 1;
    insert into public.meal_items (event_id, meal_id, name, sort_order) values (v_event, v_meal, n, i);
  end loop;

  insert into public.meals (event_id, meal_date, meal_type, description, sort_order)
  values (v_event, v_sat, 'jantar', 'Hambúrguer', 30)
  returning id into v_meal;
  i := 0;
  foreach n in array array['Pão','Carne','Queijo','Ovo','Alface','Tomate'] loop
    i := i + 1;
    insert into public.meal_items (event_id, meal_id, name, sort_order) values (v_event, v_meal, n, i);
  end loop;

  insert into public.meals (event_id, meal_date, meal_type, description, sort_order)
  values (v_event, v_sun, 'cafe_manha', 'Pão, bolo, frutas, queijo e manteiga', 10)
  returning id into v_meal;
  i := 0;
  foreach n in array array['Pão','Bolo','Frutas','Queijo','Manteiga'] loop
    i := i + 1;
    insert into public.meal_items (event_id, meal_id, name, sort_order) values (v_event, v_meal, n, i);
  end loop;

  insert into public.meal_items (event_id, name, kind, sort_order) values
    (v_event, 'Suco', 'bebida', 1),
    (v_event, 'Refrigerante', 'bebida', 2);

  -- Caronas de ida. Daniel aparece em dois carros de propósito, como nos exemplos: fica sinalizado para revisão.
  i := 0;
  for p in
    select * from (values
      ('Gilson', array['Gustavo','Sergio']),
      ('Fernanda', array['Daniel','Cauã']),
      ('Mabillys', array['Antonio','Geovane']),
      ('Gi', array['Brian','Nicolas']),
      ('Erivelton', array['Isaque','Daniel'])
    ) as t(driver, names)
  loop
    i := i + 1;
    insert into public.vehicles (event_id, direction, driver_name, seats, sort_order)
    values (v_event, 'ida', p.driver, 4, i * 10)
    returning id into v_vehicle;
    insert into public.ride_passengers (event_id, vehicle_id, participant_id)
    select v_event, v_vehicle, pa.id from public.participants pa
     where pa.event_id = v_event and pa.display_name = any (p.names);
  end loop;

  -- Banco de brincadeiras.
  insert into public.games (event_id, name, description, sort_order) values
    (v_event, 'Jogar bola', 'Quem perder realiza uma prenda.', 10),
    (v_event, 'Piscina', '', 20),
    (v_event, 'Cortar o barbante', 'Participante corta um barbante sem ver o alimento que deverá comer.', 30),
    (v_event, 'Pôr do sol no morro', '', 40);

  return v_event;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_event_owner(uuid),
  public.bulk_update_activities(uuid, jsonb),
  public.duplicate_event(uuid, text, date),
  public.create_demo_event()
to authenticated;
