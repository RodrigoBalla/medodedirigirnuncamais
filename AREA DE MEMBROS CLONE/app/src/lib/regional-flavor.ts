/**
 * Frases afetivas regionais baseadas no DDD do telefone do aluno.
 * Usadas na saudação "Bem-vindo de volta" pra criar uma conexão maior.
 *
 * Mantenha as frases:
 *  - curtas (1 linha)
 *  - calorosas e bem-humoradas
 *  - sem estereótipos negativos
 *  - com algum gancho local (lugar, comida, expressão típica)
 */
const DDD_REGIONAL_FLAVOR: Record<string, string> = {
  // ─── Sudeste ────────────────────────────────────────────────────────────
  // SP
  "11": "Olha o paulistano de volta! Bora encarar o Marginal — digo, mais uma fase. 🛣️",
  "12": "Direto do Vale do Paraíba — bora pegar essa estrada de novo!",
  "13": "Oi, baixada santista! Praia depois, prática agora.",
  "14": "Bauruense voltou! Cidade calma, cabeça calma — bora.",
  "15": "Sorocabense de volta! Bora rolar.",
  "16": "Voltou aí, ribeirão-pretano? Sertão no peito, foco no volante.",
  "17": "Rio-pretano voltou! Vamo nessa.",
  "18": "Direto de Presidente Prudente — bora pra mais uma!",
  "19": "Campineiro voltou! Bora deixar o stress de lado.",
  // RJ
  "21": "Eita, carioca! O Cristo abençoa esse seu volante. 🙌",
  "22": "Direto do norte fluminense — bora!",
  "24": "Petropolitano voltou! Serra fluminense te espera.",
  // ES
  "27": "Capixaba de volta! Moqueca depois, foco agora. 🍲",
  "28": "Voltou pro interior capixaba! Vamo.",
  // MG
  "31": "Mineiro? Trem bão demais te ver de volta, uai! ☕",
  "32": "Voltou pra Juiz de Fora! Bora lá.",
  "33": "Vale do Aço presente! Forja de gente boa.",
  "34": "Triângulo Mineiro no rolê! Bora.",
  "35": "Sul de Minas voltou! Café fresquinho, motor quentinho.",
  "37": "Centro-oeste mineiro de volta! Vamo.",
  "38": "Montes Claros voltou! Sertão forte, motorista forte.",

  // ─── Sul ────────────────────────────────────────────────────────────────
  // PR
  "41": "Curitibano de volta! Bora deixar o nevoeiro pra trás.",
  "42": "Voltou pra Ponta Grossa! Vamo.",
  "43": "Londrinense voltou!",
  "44": "Maringaense voltou! Bora.",
  "45": "Voltou pra Foz/Cascavel! Cataratas no peito.",
  "46": "Sudoeste paranaense voltou!",
  // SC
  "47": "Vale do Itajaí voltou! Bora.",
  "48": "Manezinho de volta! Floripa contigo. 🏝️",
  "49": "Voltou pro oeste catarinense! Vamo.",
  // RS
  "51": "Tchê! Bah, voltou — bora dar uma volta de carro? 🧉",
  "53": "Pelotense de volta! Doce gaúcho.",
  "54": "Serra gaúcha voltou! Frio mas firme.",
  "55": "Direto da fronteira gaúcha! Bora.",

  // ─── Nordeste ───────────────────────────────────────────────────────────
  // BA
  "71": "Soteropolitano! Axé pra essa missão! ⚡",
  "73": "Sul da Bahia voltou! Bora.",
  "74": "Direto de Juazeiro/Bahia! Sertão forte.",
  "75": "Feirense voltou! Vamo.",
  "77": "Sudoeste baiano voltou! Bora pra cima.",
  // SE
  "79": "Sergipano voltou! Vamo.",
  // PE
  "81": "Recifense! Frevo no peito, foco no volante! 🎶",
  "87": "Sertanejo pernambucano voltou! Caatinga forte, motorista forte.",
  // AL
  "82": "Alagoano voltou! Bora.",
  // PB
  "83": "Paraibano de volta! Vamo nessa.",
  // RN
  "84": "Potiguar voltou! Sol forte como você. ☀️",
  // CE
  "85": "Cearense! Sol forte é o seu lema. Bora pra cima!",
  "88": "Voltou pro interior do Ceará!",
  // PI
  "86": "Piauiense voltou! Vamo.",
  "89": "Voltou pro interior piauiense!",
  // MA
  "98": "Maranhense voltou! São Luís te espera de volta.",
  "99": "Voltou pro interior do MA!",

  // ─── Norte ──────────────────────────────────────────────────────────────
  // PA
  "91": "Paraense voltou! Açaí no copo, foco no volante! 🍇",
  "93": "Voltou pra Santarém! Vamo.",
  "94": "Direto do Pará — bora!",
  // AM
  "92": "Manauara! Quem dirige em Manaus encara qualquer trânsito. 💪",
  "97": "Voltou pro interior do AM!",
  // AC
  "68": "Acreano voltou! Floresta abençoando o trajeto. 🌳",
  // RO
  "69": "Rondoniense voltou! Bora.",
  // RR
  "95": "Roraimense voltou! Vamo.",
  // AP
  "96": "Amapaense voltou! Bora.",
  // TO
  "63": "Tocantinense de volta! Vamo.",

  // ─── Centro-Oeste ───────────────────────────────────────────────────────
  // GO
  "62": "Goianiense voltou! Vamo.",
  "64": "Voltou pro interior de GO! Bora.",
  // DF
  "61": "Brasiliense de volta! Esplanada vibrando por você. 🏛️",
  // MT
  "65": "Cuiabano voltou! Calor e foco. 🔥",
  "66": "Voltou pro interior de MT!",
  // MS
  "67": "Sul-mato-grossense voltou! Pantanal abrindo caminhos.",
};

/**
 * Devolve a frase regional pra um DDD, ou null se desconhecido / inválido.
 */
export function getRegionalFlavor(ddd: string | null | undefined): string | null {
  if (!ddd) return null;
  return DDD_REGIONAL_FLAVOR[ddd] ?? null;
}
