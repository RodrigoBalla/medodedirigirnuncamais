# Campos dos produtos atuais — pra recriar na Eduzz

> Snapshot tirado do banco em **2026-08-18**. São os produtos vivos hoje na plataforma
> (Escola de Condutores). Use como base pra recriar cada produto na Eduzz depois de inativar os antigos.
>
> **Preço NÃO aparece aqui** porque o preço mora só na Eduzz — não fica salvo no nosso banco.
> As **capas prontas em JPG** (1080×1080) pra subir na Eduzz estão em `CAPAS EDUZZ/`.

---

## ⚠️ LEIA ANTES — o passo que NÃO pode esquecer

Quando você criar os produtos novos, a Eduzz vai gerar **IDs novos** e **links de checkout novos**.
O nosso sistema libera acesso pelo **ID do produto Eduzz**. Se os IDs mudarem e a gente não atualizar,
**as vendas novas entram mas o acesso NÃO é liberado automaticamente** (cai em "ignorado").

Então, assim que você tiver os produtos novos criados, me manda:
1. O **ID novo** de cada produto (aparece na URL do produto na Eduzz, ex: `id=30XXXXX`).
2. O **link de checkout novo** de cada um (`https://chk.eduzz.com/XXXXXXXX`).

Que eu:
- Atualizo o mapeamento (`access_groups.eduzz_product_ids`) pra liberar acesso com os IDs novos.
- Troco os links de checkout na área de membros (banner, tela de renovação, páginas de cada curso).
- Deploy. Aí fica tudo funcionando com os produtos novos.

**Config que você precisa repetir em CADA produto novo na Eduzz:**
- **Postback / Webhook (Postback 2.0):** copie a MESMA URL de postback que já está nos produtos atuais
  (Eduzz → produto → Integrações/Postback). É ela que dispara a liberação de acesso.
- **Página de obrigado:** `https://medodedirigirnuncamais.netlify.app/obrigado`
- **Formato de entrega:** conteúdo externo (a entrega é a nossa área de membros via webhook, não a área da Eduzz).

---

## 1) Escola de Condutores (Módulo Completo)  ⭐ produto principal

| Campo | Valor |
|---|---|
| **Nome** | Escola de Condutores (Módulo Completo) |
| **Descrição** | O combo perfeito para todo motorista iniciante ou que ainda tem medo de sair com o carro da garagem. |
| **Capa (Eduzz)** | `CAPAS EDUZZ/escola-de-condutores-modulo-completo.jpg` |
| **Checkout atual** | https://chk.eduzz.com/E05NOV749X |
| **IDs Eduzz atuais** | `3022323`, `3085197` |
| **Grupo de acesso que libera** | Acesso Completo → libera o curso "Escola de Condutores (Módulo Completo)" |
| **Conteúdo** | 1 módulo · 21 aulas |
| **Nome antigo na Eduzz** | "Medo de Dirigir Nunca Mais - Método Completo" |

---

## 2) Dominando as Balizas

| Campo | Valor |
|---|---|
| **Nome** | Dominando as Balizas |
| **Descrição** | Baliza em vaga apertada, baliza diagonal, baliza paralela e dicas de referência visual pra estacionar sem suar frio. |
| **Capa (Eduzz)** | `CAPAS EDUZZ/dominando-as-balizas.jpg` |
| **Checkout atual** | https://chk.eduzz.com/40QRDDAK9B |
| **IDs Eduzz atuais** | `3024578`, `3087136` |
| **Grupo de acesso que libera** | Acesso Balizas → libera o curso "Dominando as Balizas" |
| **Conteúdo** | 1 módulo · 12 aulas |

---

## 3) Dominando as Ladeiras

| Campo | Valor |
|---|---|
| **Nome** | Dominando as Ladeiras |
| **Descrição** | Saída em rampa, freio de mão, embreagem no ponto de arrancada e descida segura — destrava o medo de pegar ladeira de uma vez. |
| **Capa (Eduzz)** | `CAPAS EDUZZ/dominando-as-ladeiras.jpg` |
| **Checkout atual** | https://chk.eduzz.com/1W32VVPG92 |
| **IDs Eduzz atuais** | `3024599`, `3087138` |
| **Grupo de acesso que libera** | Acesso Ladeiras → libera o curso "Dominando as Ladeiras" |
| **Conteúdo** | 1 módulo · 16 aulas |

---

## 4) Dominando as Marchas

| Campo | Valor |
|---|---|
| **Nome** | Dominando as Marchas |
| **Descrição** | Trocar marcha sem afogar, dosar embreagem, subir e descer marchas com fluidez — o curso pra quem trava na hora de mudar. |
| **Capa (Eduzz)** | `CAPAS EDUZZ/dominando-as-marchas.jpg` |
| **Checkout atual** | https://chk.eduzz.com/60E2BB53W3 |
| **IDs Eduzz atuais** | `3024604`, `3087139` |
| **Grupo de acesso que libera** | Acesso Marchas → libera o curso "Dominando as Marchas" |
| **Conteúdo** | 1 módulo · 14 aulas |

---

## 5) O Mapa do Condutor

| Campo | Valor |
|---|---|
| **Nome** | O Mapa do Condutor |
| **Descrição** | Guia completo com tudo que você precisa saber sobre o dia a dia do condutor: documentação, manutenção básica, posturas corretas e o que fazer em cada situação. |
| **Capa (Eduzz)** | `CAPAS EDUZZ/o-mapa-do-condutor.jpg` |
| **Checkout atual** | https://chk.eduzz.com/39VKJJ1BWR |
| **IDs Eduzz atuais** | `3024612`, `3087141` |
| **Grupo de acesso que libera** | Acesso Mapa do Condutor → libera o curso "O Mapa do Condutor" |
| **Conteúdo** | 1 módulo · 21 aulas |

---

## 6) Acesso Completo à Plataforma  (bundle — libera TUDO por 12 meses)

> Esse é o produto que aparece no **banner fixo** da área de membros e na **tela de renovação**.
> Não é um curso separado: é um combo que libera os 5 cursos (atuais e futuros) por 12 meses.

| Campo | Valor |
|---|---|
| **Nome** | Escola de Condutores — Acesso Completo à Plataforma |
| **Descrição sugerida** | Acesso a TODOS os cursos da plataforma — atuais e futuros — por 12 meses. |
| **Capa (Eduzz)** | usar a mesma do principal (`CAPAS EDUZZ/escola-de-condutores-modulo-completo.jpg`) |
| **Checkout atual** | https://chk.eduzz.com/6W4GVO430Z |
| **ID Eduzz atual** | `3084222` |
| **Grupo de acesso que libera** | Acesso completo a plataforma → libera os 5 cursos |
| **Nome antigo na Eduzz** | "Medo de Dirigir Nunca Mais (acesso completo)" |

---

## Resumo rápido (todos os checkouts/IDs de hoje)

| Produto | ID(s) Eduzz | Checkout atual |
|---|---|---|
| Escola de Condutores (Módulo Completo) | 3022323 · 3085197 | E05NOV749X |
| Dominando as Balizas | 3024578 · 3087136 | 40QRDDAK9B |
| Dominando as Ladeiras | 3024599 · 3087138 | 1W32VVPG92 |
| Dominando as Marchas | 3024604 · 3087139 | 60E2BB53W3 |
| O Mapa do Condutor | 3024612 · 3087141 | 39VKJJ1BWR |
| Acesso Completo à Plataforma (bundle) | 3084222 | 6W4GVO430Z |

*(Onde tem 2 IDs por produto: o 1º é o produto principal, o 2º é a oferta/order bump que já existia. Ambos liberam o mesmo grupo.)*
