# 🟢 OrácuLocaliza

Sistema de **previsão de trajetos e consumo de combustível** para veículos da Localiza — app web instalável (PWA), 100% gratuito, sem servidor e sem chaves de API pagas.

---

## 🆓 Como isso ficou 100% gratuito

A versão anterior deste projeto usava Google Maps (exige cartão de crédito cadastrado) e um backend Node/SQLite (exigiria um servidor pago para ficar sempre no ar). Esta versão foi reconstruída para eliminar as duas coisas:

| Antes | Agora | Custo |
|---|---|---|
| Google Directions API | **OSRM** (Open Source Routing Machine) | Gratuito, sem chave |
| Google Geocoding API | **Nominatim** (OpenStreetMap) | Gratuito, sem chave |
| Google Maps JavaScript (mapa) | **Leaflet + OpenStreetMap/Esri** | Gratuito, sem chave |
| Backend Node + SQLite | Tudo roda **no navegador** | Gratuito, sem servidor |
| Excel gerado no servidor | Excel gerado **no navegador** (SheetJS) | Gratuito |

Resultado: o app inteiro é um conjunto de arquivos estáticos (HTML/CSS/JS). Não precisa de servidor rodando — qualquer hospedagem de site estático gratuita serve.

**Única limitação a saber:** o OSRM (rotas gratuitas) não tem uma opção para "evitar pedágios" como o Google tinha — ele sempre calcula a rota mais rápida segundo o mapa OpenStreetMap, podendo incluir pedágios.

---

## 📦 Seus arquivos reais já estão no sistema

- ✅ **71 lojas reais** extraídas do seu `Book_12.pdf` (código, nome, endereço, bairro, zona) — incluindo a `VCNAU`
- ✅ Sua **logo oficial** já aplicada: ícones do app (192px e 512px), ícone "maskable", favicon e o logotipo no cabeçalho
- ✅ Cores do tema (verde e grafite) extraídas diretamente da sua logo

Se no futuro a Localiza atualizar a lista de lojas, é só me enviar o PDF novo nesta conversa que eu atualizo o arquivo `frontend/src/data/stores.json` e publico de novo.

---

## 🧠 Como funciona agora (tudo no navegador)

1. **Busca de destino** (`"nau"` → `VCNAU`): índice de busca instantâneo em JavaScript, sem rede.
2. **Geocodificação** (endereço → coordenadas): ao clicar em "PREVISÃO", o navegador consulta o Nominatim (OpenStreetMap) — resultado fica guardado no `localStorage` do aparelho, então o mesmo endereço nunca é consultado duas vezes.
3. **Cálculo de rota**: o navegador consulta o OSRM com as coordenadas de origem e destino, recebendo distância, tempo e o desenho da rota.
4. **Cálculo de combustível**: perfil do veículo (Econômico +12%, Moderado 0%, Alto consumo −18%) aplicado sobre o consumo em etanol do veículo, com 3 cenários (pessimista/mediano/otimista).
5. **Mapa**: Leaflet desenha a rota (linha azul), origem (verde) e destino (vermelho) sobre tiles do OpenStreetMap, com opção de vista satélite (Esri).
6. **Salvar consulta / Histórico**: gravado no `localStorage` do navegador/aparelho usado — **é por aparelho**, não é compartilhado entre dispositivos diferentes (ver seção "Limitações" abaixo).
7. **Excel**: os botões "Excel de hoje" e "Exportar filtrado" (aba Histórico) geram o arquivo `.xlsx` na hora e baixam direto pelo navegador.
8. **Google Maps / Waze**: continuam sendo apenas links de navegação (não usam API paga) — abrem o app/site já com destino preenchido, prontos para navegar.

---

## ⚠️ Limitações importantes de uma versão 100% gratuita e sem servidor

- **Histórico é por aparelho/navegador.** Como não há mais banco de dados central, o que você salva no celular não aparece automaticamente no computador (cada um tem seu próprio `localStorage`). Se limpar os dados do navegador/app, o histórico se perde. Isso é inerente a qualquer app "sem backend" gratuito.
- **Sem "evitar pedágio" garantido**, como explicado acima (limitação do OSRM gratuito).
- **Geocodificação depende do Nominatim estar no ar.** É um serviço confiável e usado por milhares de projetos, mas, por ser gratuito, pode eventualmente ficar mais lento em horários de pico.

Se no futuro você quiser um histórico compartilhado entre todos os usuários (banco de dados real) ou rotas evitando pedágio com garantia, isso exigiria voltar a ter um servidor e possivelmente uma chave paga do Google — me avise se quiser essa versão no futuro.

---

## 🛠️ Tecnologias

React 18 + Vite + TypeScript + Material UI · Leaflet · OSRM · Nominatim · SheetJS (xlsx) · vite-plugin-pwa

Projeto 100% estático — a pasta `frontend/dist` (gerada pelo build) é tudo o que precisa ser publicado.
