// ============================================================
// OrácuLocaliza — Helper para caminhos de imagens/ícones públicos
//
// BUG QUE ISSO CORRIGE: o site é publicado numa subpasta do GitHub
// Pages (https://usuario.github.io/oraculocaliza/), mas o código
// usava caminhos começando com "/" (ex: src="/logo.png"), que o
// navegador interpreta como a RAIZ do domínio inteiro
// (https://usuario.github.io/logo.png) — um endereço que não existe,
// por isso a imagem aparecia "quebrada". Usando import.meta.env.BASE_URL
// (que o Vite já configura certinho para a subpasta), o caminho fica
// sempre correto, seja publicado na raiz de um domínio ou numa subpasta.
// ============================================================

export function asset(path: string): string {
  const clean = path.replace(/^\//, '');
  return `${import.meta.env.BASE_URL}${clean}`;
}
