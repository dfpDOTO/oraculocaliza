// ============================================================
// OrácuLocaliza — Formatação de nível de tanque em oitavos
// "0/8" é sempre exibido como "RESERVA" (mais claro para o
// operador do que um número), em qualquer lugar do sistema.
// ============================================================

export function formatEighths(n: number): string {
  return n === 0 ? 'RESERVA' : `${n}/8`;
}
