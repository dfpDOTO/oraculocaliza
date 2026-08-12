// ============================================================
// OrácuLocaliza — Edge Function: admin-manage-user
// Ações administrativas que PRECISAM de privilégio elevado
// (nunca disponível no navegador): resetar senha de outra pessoa,
// excluir usuário de verdade (login + perfil) e criar usuário.
//
// Só quem chama autenticado como Administrador consegue executar.
// Precisa da variável SUPABASE_SERVICE_ROLE_KEY configurada como
// "Secret" da função no painel do Supabase.
//
// action: "reset_password" | "delete_user" | "create_user"
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida.' }), { status: 401, headers: corsHeaders });
    }

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'administrador') {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem executar esta ação.' }), { status: 403, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const { action } = body;

    // ------------------------------------------------------------
    if (action === 'reset_password') {
      const { userId } = body;
      if (!userId) return new Response(JSON.stringify({ error: 'userId é obrigatório.' }), { status: 400, headers: corsHeaders });

      const { data: targetProfile } = await callerClient.from('profiles').select('is_protected').eq('id', userId).single();
      if (targetProfile?.is_protected) {
        return new Response(JSON.stringify({ error: 'Este usuário é protegido e não pode ter a senha resetada por outro administrador.' }), { status: 403, headers: corsHeaders });
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password: '123456' });
      if (updateError) return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: corsHeaders });

      await adminClient.from('profiles').update({ must_change_password: true }).eq('id', userId);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }

    // ------------------------------------------------------------
    if (action === 'delete_user') {
      const { userId } = body;
      if (!userId) return new Response(JSON.stringify({ error: 'userId é obrigatório.' }), { status: 400, headers: corsHeaders });

      const { data: targetProfile } = await callerClient.from('profiles').select('is_protected').eq('id', userId).single();
      if (targetProfile?.is_protected) {
        return new Response(JSON.stringify({ error: 'Este usuário é protegido e não pode ser excluído.' }), { status: 403, headers: corsHeaders });
      }

      // Apaga o login (auth.users) — isso também limpa o perfil sozinho,
      // pois a tabela profiles tem "on delete cascade" ligada ao auth.users.
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: corsHeaders });

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }

    // ------------------------------------------------------------
    if (action === 'create_user') {
      const { username, role, maxDevices } = body;
      if (!username) return new Response(JSON.stringify({ error: 'username é obrigatório.' }), { status: 400, headers: corsHeaders });

      const email = `${String(username).trim().toLowerCase()}@oraculolocaliza.local`;

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: '123456',
        email_confirm: true
      });
      if (createError || !created.user) {
        const msg = createError?.message?.toLowerCase().includes('already') ? 'Já existe um usuário com esse nome.' : (createError?.message || 'Erro desconhecido.');
        return new Response(JSON.stringify({ error: msg }), { status: 400, headers: corsHeaders });
      }

      const { error: profileError } = await adminClient.from('profiles').insert({
        id: created.user.id,
        username: String(username).trim(),
        role: role || 'operador',
        permissions: {},
        must_change_password: true,
        is_active: true,
        max_devices: Math.max(1, Math.min(10, maxDevices || 2))
      });
      if (profileError) {
        // se o perfil falhar, desfaz o login criado para não deixar lixo órfão
        await adminClient.auth.admin.deleteUser(created.user.id);
        return new Response(JSON.stringify({ error: 'Erro ao salvar perfil: ' + profileError.message }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true, userId: created.user.id }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
