// ============================================================
// OrácuLocaliza — Pontos fixos da rota operacional
// A rota agora é SEMPRE: CDBRI -> Posto autorizado -> Destino
// Endereços confirmados a partir dos links do Google Maps
// enviados pelo usuário (Centro de Desativação e Posto Petrobras).
// ============================================================

export const CDBRI = {
  code: 'CDBRI',
  name: 'Centro de Desativação Localiza',
  address: 'Rod. Pres. Castello Branco, 296, Jardim Itaquiti, Jandira, SP'
};

export const POSTO = {
  code: 'POSTO',
  name: 'Posto Petrobras (Autorizado)',
  address: 'Estr. Dr. Yojiro Takaoka, 90, Jardim Itaqui, Barueri, SP, 06423-150'
};

// Mantido por compatibilidade com o restante do app (ORIGIN = ponto de partida exibido)
export const ORIGIN = CDBRI;
