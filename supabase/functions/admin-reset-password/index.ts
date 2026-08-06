// ============================================================
// OrácuLocaliza — Edge Function: admin-reset-password
// Reseta a senha de OUTRO usuário para "123456" e marca troca
// obrigatória no próximo login. Só quem chama autenticado como
// Administrador consegue executar (verificado abaixo).
//
// Precisa da variável de ambiente SUPABASE_SERVICE_ROLE_KEY,
// configurada como "Secret" da função no painel do Supabase
// (nunca fica exposta ao navegador).
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

    // Cliente com a credencial de quem chamou, só para checar se é admin
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
      return new Response(JSON.stringify({ error: 'Apenas administradores podem resetar senhas.' }), { status: 403, headers: corsHeaders });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId é obrigatório.' }), { status: 400, headers: corsHeaders });
    }

    const { data: targetProfile } = await callerClient
      .from('profiles')
      .select('is_protected')
      .eq('id', userId)
      .single();

    if (targetProfile?.is_protected) {
      return new Response(JSON.stringify({ error: 'Este usuário é protegido e não pode ter a senha resetada por outro administrador.' }), { status: 403, headers: corsHeaders });
    }

    // Cliente com privilégio de serviço — só existe dentro da Edge Function
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password: '123456' });
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: corsHeaders });
    }

    await adminClient.from('profiles').update({ must_change_password: true }).eq('id', userId);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
