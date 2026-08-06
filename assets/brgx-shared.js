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
