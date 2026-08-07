/* BRGX MEU — bolinha flutuante do especialista + mini-chat (Chico/Charles/Chalita/Chez/Check/Michelangelo).
   Chama o backend real (Firebase Functions + Gemini) — ver functions/README.md para deploy.
   Sem a URL configurada abaixo, o chat mostra um erro amigável em vez de travar a página. */

// TROQUE depois do deploy (ver functions/README.md, passo 5). Ex.: 'https://us-central1-SEU-PROJETO.cloudfunctions.net'
const FUNCTIONS_BASE_URL = '';

const SPECIALIST_META = {
  chico: { nome: 'Chico', mono: 'CHI' },
  charles: { nome: 'Charles', mono: 'CHA' },
  chalita: { nome: 'Chalita', mono: 'CHL' },
  chez: { nome: 'Chez', mono: 'CHZ' },
  check: { nome: 'Check', mono: 'CHK' },
  michelangelo: { nome: 'Michelangelo', mono: 'MI' },
};

function brgxInitSpecialist(specialistId) {
  const meta = SPECIALIST_META[specialistId];
  if (!meta) return;

  const bubble = document.createElement('button');
  bubble.className = 'brgx-spec-bubble';
  bubble.type = 'button';
  bubble.textContent = meta.mono;
  bubble.setAttribute('aria-label', 'Falar com ' + meta.nome);

  const panel = document.createElement('div');
  panel.className = 'brgx-spec-panel';
  panel.innerHTML = `
    <div class="brgx-spec-card">
      <div class="brgx-spec-head">
        <span class="name"></span>
        <button type="button" data-act="close" aria-label="Fechar">✕</button>
      </div>
      <div class="brgx-spec-msgs"></div>
      <form class="brgx-spec-form">
        <button type="button" class="mic" data-act="mic" title="Falar">🎙</button>
        <input type="text" placeholder="Escreva pra ${meta.nome}…" autocomplete="off" />
        <button type="submit" class="send" title="Enviar">➤</button>
      </form>
    </div>`;
  panel.querySelector('.name').textContent = meta.nome;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  const historyKey = 'brgx-chat-' + specialistId;
  let history = brgxStorageGet(historyKey, []);
  const msgsEl = panel.querySelector('.brgx-spec-msgs');
  const inputEl = panel.querySelector('input');
  const formEl = panel.querySelector('form');
  const micBtn = panel.querySelector('[data-act="mic"]');

  function renderMsgs() {
    msgsEl.innerHTML = '';
    history.forEach((m) => {
      const el = document.createElement('div');
      el.className = 'brgx-spec-msg ' + m.role;
      el.textContent = m.text;
      msgsEl.appendChild(el);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function addMsg(role, text) {
    history.push({ role, text });
    brgxStorageSet(historyKey, history);
    renderMsgs();
  }

  function openPanel() {
    panel.classList.add('open');
    renderMsgs();
    inputEl.focus();
  }
  function closePanel() { panel.classList.remove('open'); }

  bubble.addEventListener('click', openPanel);
  panel.addEventListener('click', (e) => { if (e.target === panel) closePanel(); });
  panel.querySelector('[data-act="close"]').addEventListener('click', closePanel);

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    addMsg('user', text);

    if (!FUNCTIONS_BASE_URL) {
      addMsg('error', 'Backend ainda não configurado — veja functions/README.md para ligar ' + meta.nome + ' de verdade.');
      return;
    }

    const thinking = document.createElement('div');
    thinking.className = 'brgx-spec-msg model';
    thinking.textContent = '…';
    msgsEl.appendChild(thinking);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
      const res = await fetch(FUNCTIONS_BASE_URL + '/specialistChat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialistId, message: text, history: history.slice(0, -1).slice(-10) }),
      });
      thinking.remove();
      if (!res.ok) throw new Error('http_' + res.status);
      const data = await res.json();
      addMsg('model', data.reply || '(sem resposta)');
    } catch (err) {
      thinking.remove();
      addMsg('error', 'Não consegui falar com ' + meta.nome + ' agora. Tenta de novo em instantes.');
    }
  });

  // Voz — Web Speech API, com fallback silencioso se o navegador não suportar
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    const recognizer = new SpeechRecognition();
    recognizer.lang = 'pt-BR';
    recognizer.interimResults = false;
    let listening = false;
    recognizer.onresult = (e) => { inputEl.value = e.results[0][0].transcript; };
    recognizer.onend = () => { listening = false; micBtn.classList.remove('active'); };
    micBtn.addEventListener('click', () => {
      if (listening) { recognizer.stop(); return; }
      listening = true;
      micBtn.classList.add('active');
      try { recognizer.start(); } catch (e) { listening = false; micBtn.classList.remove('active'); }
    });
  } else {
    micBtn.style.display = 'none';
  }
}
