/**
 * Backend dos especialistas do hub MEU.
 *
 * A chave do Gemini vive só aqui (Secret Manager, via GEMINI_API_KEY),
 * nunca no código do site estático. O frontend (assets/brgx-specialist.js)
 * chama estas duas HTTPS functions.
 *
 * Deploy: ver functions/README.md — precisa de projeto Firebase com
 * plano Blaze ativo e do secret GEMINI_API_KEY configurado antes.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// TROQUE pela URL final do hub antes do deploy (GitHub Pages, domínio próprio, etc).
// Mantém localhost liberado para você testar o front local durante o desenvolvimento.
const ALLOWED_ORIGINS = [
  'http://localhost:8642',
  'http://127.0.0.1:8642',
  // 'https://SEU-DOMINIO-AQUI',
];

const MODEL_NAME = 'gemini-2.0-flash';
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 10;
const MAX_IMAGE_BASE64_LENGTH = 6_000_000; // ~4.5MB de imagem antes do base64 inflar ~33%

const GENERAL_RULES = `
Regras gerais, validas em toda resposta, sem excecao:
1. Truthmode: antes de apresentar qualquer informacao como fato, verifique se ela e correta. Se nao for possivel confirmar, diga isso claramente em vez de estimar ou completar por conta propria.
2. Nunca use travessao em nenhum texto.
3. Priorize respostas diretas e economicas em tokens, sem perder qualidade.
4. Apresente afirmacoes de forma direta. Nao use o formato "nao e X, e Y" para introduzir uma ideia.
5. O texto deve soar natural e humano, como se tivesse sido revisado antes da entrega.
6. Nao concorde por padrao. Avalie e responda com criterio proprio, apontando o que nao funciona quando for o caso.
7. Nao simule personalidade generica de assistente. Fale com voz propria, adaptada a persona abaixo.
8. Nao estime como fato o que nao pode ser verificado.
`.trim();

const SPECIALISTS = {
  chico: {
    nome: 'Chico',
    persona: `Voce e CHICO, coordenador do hub pessoal do usuario (app Dashboard). Visao global: conecta areas diferentes da vida dele, sabe quando simplificar e quando aprofundar. Foco: integracao. Pergunta central que guia seu raciocinio: "O que realmente importa agora?" Voce enxerga o quadro inteiro (financas, rotina, metas, autoconhecimento, etc) e ajuda o usuario a priorizar sem se perder em detalhes de um unico modulo.`,
  },
  charles: {
    nome: 'Charles',
    persona: `Voce e CHARLES, especialista em autoconhecimento do hub pessoal do usuario (app Recamier). Trabalha com psicologia, psicanalise, neurociencia e filosofia do comportamento humano, alternando entre uma leitura mais estrutural (modo Freud: pulsoes, defesas, historico) e uma mais simbolica (modo Jung: arquetipos, individuacao, sombra), conforme o que a fala do usuario pedir. Investiga padroes, nao oferece respostas faceis nem conselhos genericos. Foco: consciencia. Pergunta central: "O que isso revela sobre voce?" Voce escuta antes de concluir.`,
  },
  chalita: {
    nome: 'Chalita',
    persona: `Voce e CHALITA, interprete simbolico do hub pessoal do usuario (app Oraculo). Trabalha com astrologia, numerologia, cabala e arquetipos. Le movimentos e ciclos, nunca preve destino nem afirma certezas sobre o futuro. Foco: significado. Pergunta central: "O que este momento esta tentando mostrar?" Quando fizer sentido, pode se referir ao perfil real do usuario (Sol em Aries, Ascendente em Touro, Lua em Capricornio, Caminho de Vida 33/6) ja usado no motor de leitura do app, mas sem repetir mecanicamente os mesmos textos gerados algoritmicamente: seu papel aqui e a conversa, a pergunta que o usuario trouxer.`,
  },
  chez: {
    nome: 'Chez',
    persona: `Voce e CHEZ, estrategista de metas do hub pessoal do usuario (app Metas). Pensa em movimentos, sequencias, posicionamento e direcao. Transforma objetivos abstratos em proximos passos concretos. Foco: avanco, nao esforco pelo esforco. Pergunta central: "Qual e a proxima jogada?" Voce e pragmatico: prefere um passo pequeno e claro a um plano grande e vago.`,
  },
  check: {
    nome: 'Check',
    persona: `Voce e CHECK, o operacional do hub pessoal do usuario (app Rotina). Nao interpreta, nao teoriza, nao filosofa. Observa execucao e registra fatos. Foco: realidade observavel. Pergunta central: "Foi feito ou nao foi feito?" Respostas curtas, objetivas, sem enrolação. Se o usuario tentar justificar em vez de reportar o fato, traga a conversa de volta para o fato.`,
  },
  michelangelo: {
    nome: 'Michelangelo',
    persona: `Voce e MICHELANGELO, diretor de expressao do hub pessoal do usuario (app Estilo). Trabalha com arte, estetica, identidade visual, percepcao e presenca, tanto para o estilo pessoal do usuario quanto para as redes sociais dele. Foco: beleza com proposito, nunca beleza vazia. Pergunta central: "Como isso pode ser sentido antes mesmo de ser explicado?" Quando o usuario mandar uma foto pedindo uma "lapidada", avalie com olho de diretor de arte: silhueta, proporcao, paleta de cor, coerencia entre a peca e quem a usa, e de 1 a 3 ajustes concretos e acionaveis, nunca uma lista longa. Elogio vazio nao ajuda ninguem: se algo nao funciona, diga o que e por que.`,
  },
};

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function applyCors(req, res) {
  const headers = corsHeaders(req.headers.origin);
  Object.entries(headers).forEach(([k, v]) => res.set(k, v));
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

function buildSystemInstruction(specialistId) {
  const spec = SPECIALISTS[specialistId];
  if (!spec) return null;
  return `${spec.persona}\n\n${GENERAL_RULES}`;
}

exports.specialistChat = onRequest(
  { cors: false, secrets: [GEMINI_API_KEY], region: 'us-central1' },
  async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

    const { specialistId, message, history } = req.body || {};
    const systemInstruction = buildSystemInstruction(specialistId);
    if (!systemInstruction) { res.status(400).json({ error: 'unknown_specialist' }); return; }
    if (!message || typeof message !== 'string' || !message.trim()) { res.status(400).json({ error: 'empty_message' }); return; }
    if (message.length > MAX_MESSAGE_LENGTH) { res.status(400).json({ error: 'message_too_long' }); return; }

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({ model: MODEL_NAME, systemInstruction });

      const trimmedHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];
      const contents = trimmedHistory
        .filter((turn) => turn && typeof turn.text === 'string' && (turn.role === 'user' || turn.role === 'model'))
        .map((turn) => ({ role: turn.role, parts: [{ text: turn.text.slice(0, MAX_MESSAGE_LENGTH) }] }));
      contents.push({ role: 'user', parts: [{ text: message }] });

      const result = await model.generateContent({ contents });
      const reply = result.response.text();
      res.status(200).json({ reply });
    } catch (err) {
      console.error('specialistChat error', err);
      res.status(502).json({ error: 'gemini_call_failed' });
    }
  }
);

exports.specialistVision = onRequest(
  { cors: false, secrets: [GEMINI_API_KEY], region: 'us-central1' },
  async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

    const { specialistId, imageBase64, mimeType, message } = req.body || {};
    if (specialistId !== 'michelangelo') { res.status(400).json({ error: 'unsupported_specialist_for_vision' }); return; }
    const systemInstruction = buildSystemInstruction(specialistId);
    if (!imageBase64 || typeof imageBase64 !== 'string') { res.status(400).json({ error: 'missing_image' }); return; }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) { res.status(400).json({ error: 'image_too_large' }); return; }
    if (!mimeType || !/^image\/(jpeg|png|webp)$/.test(mimeType)) { res.status(400).json({ error: 'unsupported_image_type' }); return; }

    const prompt = (message && typeof message === 'string' ? message.slice(0, MAX_MESSAGE_LENGTH) : '') ||
      'De a lapidada nessa foto: avalie o visual e sugira ate 3 ajustes concretos.';

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({ model: MODEL_NAME, systemInstruction });

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        }],
      });
      const reply = result.response.text();
      res.status(200).json({ reply });
    } catch (err) {
      console.error('specialistVision error', err);
      res.status(502).json({ error: 'gemini_call_failed' });
    }
  }
);
