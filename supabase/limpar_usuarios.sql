-- ============================================================
-- OrácuLocaliza — Limpeza completa de usuários (mantém só o Junior)
-- Remove TANTO o login quanto o perfil de todo mundo, exceto Junior.
-- Isso evita o problema de "usuário fantasma" que ficava impedindo
-- recriar alguém com o mesmo nome depois de excluído.
-- ============================================================

-- Remove os dispositivos conectados de todo mundo, exceto Junior
delete from user_devices
where user_id in (select id from profiles where username <> 'Junior');

-- Remove bloqueios de tentativa de login de todo mundo, exceto Junior
delete from login_attempts where lower(username) <> 'junior';

-- Remove o LOGIN (auth.users) de todo mundo, exceto Junior.
-- Isso também apaga o perfil sozinho (a tabela profiles está
-- configurada com "ON DELETE CASCADE" ligada ao login).
delete from auth.users
where email <> 'junior@oraculolocaliza.local';
