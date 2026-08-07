# Backend dos especialistas (Chico, Charles, Chalita, Chez, Check, Michelangelo)

Este backend existe só para uma coisa: chamar o Gemini sem expor a chave da API no site estático. O código já está pronto, o que falta é você rodar os passos abaixo uma única vez (uns 10 minutos).

## 1. Login (uma vez)

```bash
npm install -g firebase-tools
firebase login
```

Abre o navegador com a sua conta Google. Só precisa fazer isso uma vez por máquina.

## 2. Projeto Firebase com plano Blaze

Se você ainda não tem um projeto Firebase para o hub MEU:

1. Acesse https://console.firebase.google.com → "Adicionar projeto".
2. Depois de criado, vá em **Configurações do projeto → Uso e faturamento** e mude para o plano **Blaze** (pay-as-you-go). As Cloud Functions só rodam nesse plano — o uso pessoal de um app assim custa centavos por mês, mas o Google exige um cartão vinculado.
3. Na raiz do repo (`me/`), rode:

```bash
firebase use --add
```

e selecione o projeto que você acabou de criar.

## 3. Chave do Gemini

1. Gere uma chave em https://aistudio.google.com/apikey (ou ative a API Gemini no seu projeto GCP via Vertex AI, se preferir).
2. Configure como secret do Firebase (nunca cole a chave em nenhum arquivo do repo):

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Cole a chave quando pedido.

## 4. Deploy

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Ao final, o terminal mostra as URLs das duas functions, algo como:

```
specialistChat: https://us-central1-SEU-PROJETO.cloudfunctions.net/specialistChat
specialistVision: https://us-central1-SEU-PROJETO.cloudfunctions.net/specialistVision
```

## 5. Conectar o frontend

Abra `assets/brgx-specialist.js`, troque a constante `FUNCTIONS_BASE_URL` no topo do arquivo por:

```js
const FUNCTIONS_BASE_URL = 'https://us-central1-SEU-PROJETO.cloudfunctions.net';
```

E em `functions/index.js`, adicione o domínio real onde o hub vai rodar em `ALLOWED_ORIGINS` (localhost já vem liberado para teste) antes de rodar `firebase deploy --only functions` de novo.

Commit e push. Pronto — os especialistas passam a responder de verdade.

## Custo e limites já embutidos no código

- Mensagem de texto limitada a 2000 caracteres, histórico limitado às últimas 10 mensagens por conversa.
- Imagem da "lapidada" do Michelangelo limitada a ~4.5MB.
- Sem isso, uma conversa longa ou uma imagem gigante custaria mais por chamada à toa.

Para reforçar ainda mais (opcional, fora do escopo deste PR): configurar um alerta de orçamento no GCP e, se quiser travar de vez o acesso, adicionar Firebase App Check nas duas functions.
