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

/* ============================================================================
   MOTOR BRGX — grade da rotina, hábitos, streaks e pomodoro.
   Compartilhado entre Rotina e Dashboard para existir uma fonte da verdade só.
   Regras vindas da spec do usuário + página ⚙️ BRGX do Notion.
   ============================================================================ */

const BRGX_CATS = {
  ritual:      { label:'Ritual',       var:'--ritual' },
  mente:       { label:'Mente',        var:'--mente' },
  corpo:       { label:'Corpo',        var:'--corpo' },
  criacao:     { label:'Criação',      var:'--criacao' },
  trabalho:    { label:'Trabalho',     var:'--trabalho' },
  transporte:  { label:'Transporte',   var:'--transporte' },
  regeneracao: { label:'Regeneração',  var:'--regeneracao' },
  vinculo:     { label:'Vínculo',      var:'--vinculo' },
  expressao:   { label:'Expressão',    var:'--expressao' },
  financas:    { label:'Finanças',     var:'--financas' },
  sono:        { label:'Sono',         var:'--sono' },
  folga:       { label:'Folga',        var:'--folga' },
};
function brgxCatColor(cat){ return `var(${(BRGX_CATS[cat]||BRGX_CATS.ritual).var})`; }

const BRGX_DIAS = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
const BRGX_DIA_META = {
  SEG:{ label:'Segunda', tipo:'Folga',     cat:'folga' },
  TER:{ label:'Terça',   tipo:'Trabalho',  cat:'trabalho' },
  QUA:{ label:'Quarta',  tipo:'Trabalho',  cat:'trabalho' },
  QUI:{ label:'Quinta',  tipo:'Trabalho',  cat:'trabalho' },
  SEX:{ label:'Sexta',   tipo:'Trabalho',  cat:'trabalho' },
  SAB:{ label:'Sábado',  tipo:'Trabalho',  cat:'trabalho' },
  DOM:{ label:'Domingo', tipo:'Estrutura', cat:'mente' },
};

/* Agenda física semanal — dado real, extraído do app minha-rotina.html em uso
   (substitui a versão que vinha do xlsx, que estava desatualizada). */
const BRGX_AGENDA_FISICA = {
  SEG:'Yoga', TER:'Spinning', QUA:'Corrida', QUI:'Dança', SEX:'Natação', SAB:'Livre', DOM:'Livre',
};
const BRGX_AGENDA_ICONES = {
  Yoga:'🧘', Spinning:'🚴', Corrida:'🏃', Dança:'💃', Natação:'🏊', Livre:'🌞',
};

function brgxManha(dia){
  const atividade = BRGX_AGENDA_FISICA[dia];
  const livre = atividade === 'Livre';
  return [
    { s:'05:10', e:'05:25', label:'Despertar · água morna com limão', cat:'ritual',
      nota:'Água morna com limão imediatamente. Abrir as janelas: luz natural ativa o cortisol.' },
    { s:'05:25', e:'05:50', label:'Intenção do dia', cat:'mente',
      nota:'Só escrita. Uma intenção clara para o dia. Diário é exclusivo da noite.' },
    { s:'05:50', e:'06:20', label:'Meditação', cat:'mente',
      nota:'30min. Estado de receptividade antes de qualquer ação.' },
    { s:'06:20', e:'06:30', label:'Pegar sol', cat:'corpo',
      nota:'10min de exposição solar. Vitamina D e ancoragem circadiana.' },
    { s:'06:30', e:'06:50', label:'Pet Júnior', cat:'vinculo',
      nota:'Saída da manhã, alimentação e treino curto do Júnior.' },
    { s:'07:00', e:'07:50', label: livre ? 'Treino principal' : atividade, cat:'corpo',
      nota: livre ? '50min. Treino principal do dia.' : `50min. Atividade física do dia: ${atividade}.` },
    { s:'07:50', e:'08:15', label:'Protetor, hidratante, remédio e postura', cat:'corpo',
      nota:'Skincare completo, remédio e 5min de postura.' },
  ];
}

const BRGX_NOITE = [
  { s:'19:30', e:'20:15', label:'Descompressão e alimentação', cat:'regeneracao',
    nota:'Sem tela nos primeiros 30min. Comer devagar. Transição trabalho para vida.' },
  { s:'20:15', e:'21:00', label:'Leitura / conteúdo intencional', cat:'mente',
    nota:'Leitura ou conteúdo escolhido. Sem scroll.' },
  { s:'21:00', e:'21:25', label:'Controle financeiro BRGX', cat:'financas',
    nota:'25min no máximo. Lei de Parkinson aplicada: o bloco fecha na hora.' },
  { s:'21:25', e:'21:55', label:'Diário escrito, reflexão e não fumo', cat:'ritual',
    nota:'O que fiz bem? O que solto? Qual a intenção de amanhã?' },
  { s:'21:55', e:'22:00', label:'Pet Júnior · última saída', cat:'vinculo',
    nota:'Última saída do Júnior antes de dormir.' },
  { s:'22:00', e:'05:10', label:'Sono 7h10', cat:'sono',
    nota:'Sagrado. Sem tela 30min antes.' },
];

const BRGX_TRABALHO = [
  { s:'08:30', e:'09:00', label:'Transporte ida · estudo', cat:'transporte',
    nota:'O estudo acontece aqui. Áudio, curso ou leitura no deslocamento.' },
  { s:'09:00', e:'19:00', label:'Trabalho externo · Baru', cat:'trabalho',
    nota:'Pomodoro 25/5 ativo. Inclui 1h de almoço livre, que fica fora da contagem.' },
  { s:'19:00', e:'19:30', label:'Transporte volta · estudo', cat:'transporte',
    nota:'Segundo bloco de estudo do dia.' },
];

function brgxGrade(dia){
  if (dia === 'DOM') {
    return [
      { s:'05:10', e:'05:40', label:'Despertar lento · limão', cat:'ritual', nota:'Domingo começa sem pressa.' },
      { s:'05:40', e:'06:30', label:'Oráculo semanal profundo', cat:'mente', nota:'Leitura da semana inteira. Qual a energia dominante?' },
      { s:'06:30', e:'07:10', label:'Meditação longa', cat:'mente', nota:'Prática mais longa da semana.' },
      { s:'07:10', e:'08:00', label:'Natação', cat:'corpo', nota:'Única natação da semana.' },
      { s:'08:00', e:'08:30', label:'Shake, skincare e sol', cat:'corpo' },
      { s:'08:30', e:'10:00', label:'Estrutura semanal BRGX', cat:'criacao', nota:'Revisar projetos, planejar a semana.' },
      { s:'10:00', e:'12:00', label:'Criação livre', cat:'criacao', nota:'Maior janela criativa da semana.' },
      { s:'12:00', e:'14:00', label:'Vínculo · família e amigos', cat:'vinculo', nota:'Sem celular à mesa.' },
      { s:'14:00', e:'16:30', label:'Regeneração', cat:'regeneracao', nota:'Não é hora de produzir.' },
      { s:'16:30', e:'18:00', label:'Expressão livre', cat:'expressao', nota:'Música, escrita, criação sem agenda.' },
      { s:'18:00', e:'19:30', label:'Alimentação e preparo da semana', cat:'regeneracao' },
      { s:'19:30', e:'21:00', label:'Revisão BRGX semanal', cat:'financas', nota:'O que consolidou? Manutenção digital.' },
      { s:'21:00', e:'21:55', label:'Diário e intenção da semana', cat:'ritual' },
      { s:'21:55', e:'22:00', label:'Pet Júnior · última saída', cat:'vinculo' },
      { s:'22:00', e:'05:10', label:'Sono 7h10', cat:'sono' },
    ];
  }
  if (dia === 'SEG') {
    // Folga: mantém a estrutura pessoal livre da referência, com a manhã nova por cima.
    return [
      ...brgxManha('SEG'),
      { s:'08:15', e:'09:15', label:'Bloco estratégico', cat:'criacao', nota:'Planejamento e documentos. Só produção, sem consumo.' },
      { s:'09:15', e:'10:00', label:'Café, agenda e e-mail VIP', cat:'ritual', nota:'Eisenhower do dia: 1 Faça, 2 Agende, o resto corta ou delega.' },
      { s:'10:00', e:'13:00', label:'Estrutura pessoal livre', cat:'folga', nota:'Única folga antes da semana de trabalho.' },
      { s:'13:00', e:'14:00', label:'Almoço intencional', cat:'regeneracao', nota:'Sem tela.' },
      { s:'14:00', e:'16:30', label:'Criação · produto digital', cat:'criacao', nota:'Maior bloco criativo do dia.' },
      { s:'16:30', e:'17:30', label:'Vínculo social', cat:'vinculo' },
      { s:'17:30', e:'19:00', label:'Expressão livre', cat:'expressao' },
      ...BRGX_NOITE,
    ];
  }
  return [ ...brgxManha(dia), ...BRGX_TRABALHO, ...BRGX_NOITE ];
}

function brgxDiaDeHoje(d = new Date()){ return BRGX_DIAS[d.getDay()]; }

/* Bloco atual em tempo real. Trata o bloco de sono, que atravessa a meia-noite. */
function brgxBlocoAtual(grade, agora = new Date()){
  const min = agora.getHours()*60 + agora.getMinutes();
  const toMin = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
  for (let i = 0; i < grade.length; i++){
    const b = grade[i];
    const s = toMin(b.s), e = toMin(b.e);
    const dentro = (e > s) ? (min >= s && min < e) : (min >= s || min < e);
    if (dentro) return { bloco:b, indice:i, proximo: grade[(i+1) % grade.length] };
  }
  return { bloco:null, indice:-1, proximo: grade[0] };
}

function brgxDataISO(d = new Date()){ return d.toISOString().slice(0,10); }
function brgxDiasAtras(n){ const d = new Date(); d.setDate(d.getDate()-n); return brgxDataISO(d); }

/* ---- Rotina real (extraída do app minha-rotina.html, em uso de verdade pelo usuário) ----
   Categorias, 17 hábitos com Nível (Mínimo/Ideal/Extra), views, abas, regra do dia ruim,
   tarefas de semana/fds/mês, humores de fim de semana e o protocolo de detox de 90 dias.
   Onde havia sobreposição com o que tinha sido montado a partir do PDF/Notion (Rodada 4),
   esta é a fonte que vale — dados e lógica confirmados pelo usuário como os reais. */

const BRGX_ROTINA_CATS = {
  'Organização':     '#7a5c9e',
  'Saúde':           '#4f7a5c',
  'Casa':            '#b8722e',
  'Alimentação':     '#3f9e88',
  'Mental':          '#3f6f9e',
  'Corpo':           '#4f8a8a',
  'Desenvolvimento': '#b85a72',
  'Atenção':         '#8a8471',
  'Finanças':        '#c99a3a',
  'Detox':           '#9c3b3b',
};

const BRGX_HABITOS = [
  { id:'progresso', time:'A qualquer momento', nome:'Acompanhe seu progresso diário', categoria:'Organização',     periodo:'Qualquer momento', nivel:'Mínimo', freq:'Diário' },
  { id:'limao',     time:'06:00',              nome:'Limão',                          categoria:'Saúde',           periodo:'Manhã',            nivel:'Mínimo', freq:'Diário' },
  { id:'cama',      time:'06:15',              nome:'Arrumar a cama e abrir a janela', categoria:'Casa',            periodo:'Manhã',            nivel:'Mínimo', freq:'Diário' },
  { id:'cafe',      time:'06:25',              nome:'Café da manhã',                  categoria:'Alimentação',     periodo:'Manhã',            nivel:'Mínimo', freq:'Diário' },
  { id:'previsao',  time:'06:40',              nome:'Previsão do dia',                categoria:'Mental',          periodo:'Manhã',            nivel:'Ideal',  freq:'Diário' },
  { id:'sol',       time:'07:00',              nome:'Sol e alongamento',              categoria:'Corpo',           periodo:'Manhã',            nivel:'Ideal',  freq:'Diário' },
  { id:'treino',    time:'07:10 - 08:10',      nome:'Treino',                         categoria:'Corpo',           periodo:'Manhã',            nivel:'Extra',  freq:'Diário' },
  { id:'estudo',    time:'08:00',              nome:'Estudo no caminho',              categoria:'Desenvolvimento', periodo:'Manhã',            nivel:'Ideal',  freq:'Dias úteis' },
  { id:'redes',     time:'08:30',              nome:'Redes sociais',                  categoria:'Atenção',         periodo:'Manhã',            nivel:'Extra',  freq:'Diário' },
  { id:'alimeq',    time:'08:30',              nome:'Alimentação equilibrada',        categoria:'Alimentação',     periodo:'Dia todo',         nivel:'Mínimo', freq:'Diário' },
  { id:'medita',    time:'08:50',              nome:'Meditação',                      categoria:'Mental',          periodo:'Manhã',            nivel:'Ideal',  freq:'Diário' },
  { id:'financas',  time:'21:00',              nome:'Controle financeiro',            categoria:'Finanças',        periodo:'Noite',            nivel:'Ideal',  freq:'Diário' },
  { id:'bike',      time:'21:30',              nome:'Bike',                           categoria:'Corpo',           periodo:'Noite',            nivel:'Extra',  freq:'Diário' },
  { id:'leitura',   time:'22:00',              nome:'Leitura noite',                  categoria:'Mental',          periodo:'Noite',            nivel:'Ideal',  freq:'Diário' },
  { id:'naofumo',   time:'22:40',              nome:'Não fumo',                       categoria:'Detox',           periodo:'Noite',            nivel:'Mínimo', freq:'Diário' },
  { id:'diario',    time:'22:45',              nome:'Diário',                         categoria:'Mental',          periodo:'Noite',            nivel:'Ideal',  freq:'Diário' },
  { id:'remedio',   time:'22:45',              nome:'Remédio',                        categoria:'Saúde',           periodo:'Noite',            nivel:'Mínimo', freq:'Diário' },
];

const BRGX_HABITOS_VIEWS = [
  { key:'todos',  label:'Todos' },
  { key:'manha',  label:'Manhã' },
  { key:'noite',  label:'Noite' },
  { key:'minimo', label:'Mínimo obrigatório' },
];

const BRGX_ROTINA_TABS = [
  { key:'hoje',   label:'Hoje' },
  { key:'semana', label:'Semana' },
  { key:'fds',    label:'Fim de semana' },
  { key:'mes',    label:'Mês' },
];

const BRGX_REGRA_DIA_RUIM = 'Quando a energia estiver baixa, não preciso cumprir tudo. Preciso apenas cumprir o mínimo: saúde, casa, alimentação, não fumar e remédio. O objetivo é manter a identidade, não buscar perfeição.';

const BRGX_WEEKLY_TASKS = [
  { id:'esfoliacao',   nome:'Esfoliação',          quando:'Qua e sáb' },
  { id:'mascara',      nome:'Máscara facial',       quando:'Domingo' },
  { id:'revisao_sem',  nome:'Revisão da semana',    quando:'Domingo' },
];
const BRGX_WEEKEND_TASKS = [
  { id:'autocuidado',   nome:'Autocuidado especial' },
  { id:'detox_digital', nome:'Digital detox' },
  { id:'criatividade',  nome:'Criatividade livre' },
  { id:'casa',          nome:'Organização da casa' },
  { id:'spa',           nome:'Massagem ou day spa' },
  { id:'cultural',      nome:'Evento cultural' },
];
const BRGX_MONTH_TASKS = [
  { id:'revisao_mes', nome:'Revisão mensal' },
  { id:'workshop',    nome:'Workshop ou curso' },
];
const BRGX_MOODS = [
  { key:'descansado', label:'Descansado', hint:'Chegou com energia — pode puxar o que te dá prazer e movimento.' },
  { key:'neutro',      label:'Neutro',     hint:'Equilíbrio. Um fds normal: escolha um cuidado e um prazer.' },
  { key:'cansado',     label:'Cansado',    hint:'Prioridade é restaurar. Digital detox e descanso valem mais que produtividade.' },
  { key:'ansioso',     label:'Ansioso',    hint:'Devagar. Uma coisa de cada vez — organização da casa e corpo ajudam a aterrar.' },
  { key:'animado',     label:'Animado',    hint:'Aproveite: criatividade livre ou evento cultural cabem bem agora.' },
];

function brgxSemanaKey(d = new Date()){
  const x = new Date(d);
  const dia = x.getDay();
  const diff = (dia === 0 ? -6 : 1) - dia;
  x.setDate(x.getDate() + diff);
  return 'w' + brgxDataISO(x);
}
function brgxMesKey(d = new Date()){ return 'm' + d.getFullYear() + '-' + (d.getMonth() + 1); }

/* ---- "Feito hoje" — uma chave por data (brgx-rotina-done-<data>), igual ao app real. ---- */
function brgxRotinaDoneDia(dataISO){ return brgxStorageGet('brgx-rotina-done-' + dataISO, {}); }

/* ---- Streak (não existe no app real — regra própria, aplicada aos 17 hábitos reais) ----
   21 dias consecutivos = consolidado.
   1 dia perdido mantém a sequência. 2 dias perdidos seguidos reiniciam. */
const BRGX_STREAK_CONSOLIDADO = 21;

function brgxCalcularStreak(habitoId, hoje = new Date()){
  let streak = 0, perdidosSeguidos = 0;
  for (let i = 0; i < 400; i++){
    const d = new Date(hoje); d.setDate(d.getDate()-i);
    const feito = !!brgxRotinaDoneDia(brgxDataISO(d))[habitoId];
    if (feito){ streak++; perdidosSeguidos = 0; continue; }
    // Hoje ainda não conta como perdido: o dia não acabou.
    if (i === 0) continue;
    perdidosSeguidos++;
    if (perdidosSeguidos >= 2) break;   // 2 seguidos reiniciam
  }
  return { dias: streak, consolidado: streak >= BRGX_STREAK_CONSOLIDADO };
}

function brgxAderencia(ids, dias = 7){
  let feitos = 0, total = 0;
  for (let i = 1; i <= dias; i++){
    const dl = brgxRotinaDoneDia(brgxDiasAtras(i));
    ids.forEach(id => { total++; if (dl[id]) feitos++; });
  }
  return total ? feitos/total : 0;
}

/* ---- Detox mental de 90 dias — protocolo real, chave brgx-reset-start (ISO ou null) ---- */
const BRGX_DETOX_FASES = [
  { nome:'Reset',            de:1,  ate:21, foco:'Cortar ruído e gatilhos' },
  { nome:'Evolução',         de:22, ate:45, foco:'Instalar padrões limpos' },
  { nome:'Alta performance', de:46, ate:75, foco:'Sustentar energia e foco' },
  { nome:'Maestria',         de:76, ate:90, foco:'Consolidar sem força bruta' },
];
function brgxDetoxStatus(inicioISO){
  if (!inicioISO) return { ativo:false };
  const dias = Math.min(90, Math.floor((Date.now() - new Date(inicioISO).getTime()) / 86400000) + 1);
  const pct = Math.round((dias / 90) * 100);
  const fase = BRGX_DETOX_FASES.find(f => dias >= f.de && dias <= f.ate) || BRGX_DETOX_FASES[0];
  return { ativo:true, dias, pct, fase };
}

/* ---- Pomodoro ----
   25min de foco + 5min de pausa durante 09:00–19:00, excluindo 1h de almoço.
   Fora do trabalho, a pausa de 5min só vale para tarefas maiores que 1h. */
const BRGX_POMO = { foco:25, pausa:5, almocoMin:60, janela:{ ini:'09:00', fim:'19:00' } };

function brgxCiclosPossiveis(){
  const [hi,mi] = BRGX_POMO.janela.ini.split(':').map(Number);
  const [hf,mf] = BRGX_POMO.janela.fim.split(':').map(Number);
  const total = (hf*60+mf) - (hi*60+mi) - BRGX_POMO.almocoMin;
  return Math.floor(total / (BRGX_POMO.foco + BRGX_POMO.pausa));
}

function brgxDentroDoTrabalho(agora = new Date()){
  const dia = brgxDiaDeHoje(agora);
  if (dia === 'SEG' || dia === 'DOM') return false;
  const min = agora.getHours()*60 + agora.getMinutes();
  const [hi,mi] = BRGX_POMO.janela.ini.split(':').map(Number);
  const [hf,mf] = BRGX_POMO.janela.fim.split(':').map(Number);
  return min >= (hi*60+mi) && min < (hf*60+mf);
}
