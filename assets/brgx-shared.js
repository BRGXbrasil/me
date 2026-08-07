/* BRGX MEU — utilidades compartilhadas entre os apps standalone.
   Confirm dialog substitui window.confirm(); storage helpers padronizam localStorage. */

function brgxStorageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn('brgx: falha ao ler', key, error);
    return fallback;
  }
}

function brgxStorageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('brgx: falha ao salvar', key, error);
  }
}

function brgxConfirm({ title, text, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = true } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'brgx-confirm-backdrop';
    backdrop.innerHTML = `
      <div class="brgx-confirm-card" role="alertdialog" aria-modal="true">
        <p class="brgx-confirm-title"></p>
        <p class="brgx-confirm-text"></p>
        <div class="btn-row">
          <button type="button" class="mini-btn" data-act="cancel"></button>
          <button type="button" class="mini-btn ${danger ? 'danger' : 'solid'}" data-act="confirm"></button>
        </div>
      </div>`;
    backdrop.querySelector('.brgx-confirm-title').textContent = title || 'Confirmar ação';
    backdrop.querySelector('.brgx-confirm-text').textContent = text || '';
    backdrop.querySelector('[data-act="cancel"]').textContent = cancelLabel;
    backdrop.querySelector('[data-act="confirm"]').textContent = confirmLabel;

    function close(result) {
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 150);
      resolve(result);
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
    });
    backdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
    backdrop.querySelector('[data-act="confirm"]').addEventListener('click', () => close(true));

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));
  });
}

function brgxDateLine(date = new Date()) {
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${DIAS[date.getDay()]}, ${date.getDate()} de ${MESES[date.getMonth()]}`;
}

function brgxInitTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem('brgx-self-theme') || 'light';
  if (saved === 'acqua') root.setAttribute('data-brgx-theme', 'acqua');
}
brgxInitTheme();

/* ===== Leitura em voz alta compartilhada (mesmo padrão validado no Oráculo) ===== */

let _brgxVozes = [];
let _brgxVozTocando = false;

function brgxCarregarVozesPTBR() {
  const todas = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  _brgxVozes = todas.filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('pt'));
  return _brgxVozes;
}
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = brgxCarregarVozesPTBR;
  let _brgxTentativas = 0;
  (function poll(){ _brgxTentativas++; const p = brgxCarregarVozesPTBR(); if(!p.length && _brgxTentativas < 12) setTimeout(poll, 400); })();
}

function brgxVozPreferidaMasculina(vozes) {
  const MASC = ['felipe', 'daniel', 'joaquim', 'ricardo', 'antonio', 'antônio', 'thiago', 'bruno', 'marcos', 'paulo', 'carlos', 'diego', 'eddy', 'reed', 'rocko', 'male', 'masculin', 'homem'];
  const FEM = ['luciana', 'joana', 'maria', 'catarina', 'fernanda', 'ines', 'inês', 'francisca', 'female', 'feminin', 'mulher', 'google portugu', 'flo', 'sandy', 'shelley'];
  const BOA = ['enhanced', 'premium', 'neural', 'natural', 'siri'];
  const nota = (v) => {
    const n = (v.name || '').toLowerCase();
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    let s = 0;
    if (MASC.some((m) => n.includes(m))) s += 100;
    if (FEM.some((f) => n.includes(f))) s -= 80;
    if (BOA.some((b) => n.includes(b))) s += 40;
    if (lang.indexOf('pt-br') === 0) s += 10; else if (lang.indexOf('pt') === 0) s += 4;
    if (v.localService) s += 5;
    return s;
  };
  return vozes.slice().sort((a, b) => nota(b) - nota(a))[0] || null;
}

function brgxSegmentarFala(texto) {
  const partes = String(texto).replace(/[—–]/g, ',').split(/([.!?…]+)/);
  const frases = [];
  for (let i = 0; i < partes.length; i += 2) {
    const corpo = (partes[i] || '').trim();
    const pont = partes[i + 1] || '';
    if (corpo) frases.push(corpo + pont);
  }
  return frases.length ? frases : [String(texto).trim()].filter(Boolean);
}

function brgxPegarVoz(storageKey) {
  const vozes = _brgxVozes.length ? _brgxVozes : brgxCarregarVozesPTBR();
  const nomeSalvo = localStorage.getItem(storageKey || 'brgx-voz-nome');
  if (nomeSalvo) { const esc = vozes.find(v => v.name === nomeSalvo); if (esc) return esc; }
  return brgxVozPreferidaMasculina(vozes);
}

function brgxOuvirTexto(texto, onDone, storageKey) {
  if (!('speechSynthesis' in window)) return;
  if (_brgxVozTocando) { window.speechSynthesis.cancel(); _brgxVozTocando = false; onDone && onDone(); return; }
  window.speechSynthesis.cancel();
  const voz = brgxPegarVoz(storageKey);
  const frases = brgxSegmentarFala(texto);
  if (!frases.length) return;
  _brgxVozTocando = true;
  (function falarIndice(i){
    if (i >= frases.length) { _brgxVozTocando = false; onDone && onDone(); return; }
    const utter = new SpeechSynthesisUtterance(frases[i]);
    utter.lang = 'pt-BR'; if (voz) utter.voice = voz; utter.rate = 0.95; utter.pitch = 0.7;
    utter.onend = () => { if (_brgxVozTocando) setTimeout(() => falarIndice(i + 1), 260); };
    utter.onerror = () => { _brgxVozTocando = false; onDone && onDone(); };
    window.speechSynthesis.speak(utter);
  })(0);
}

function brgxVozEstaTocando(){ return _brgxVozTocando; }
