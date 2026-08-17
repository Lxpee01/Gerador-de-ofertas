# Gerador de Ofertas

App web para automatizar a criação de ofertas de afiliado prontas para WhatsApp.

## MVP atual (passos 1 e 2)

- Tela principal com input de link e botão "Gerar oferta"
- API `/api/extract-product` com scraper da **Amazon**
- Detecção de plataforma e resolução de links encurtados (`amzn.to`, etc.)

## Como rodar

```bash
npm install
npm run dev
```

Na primeira instalação, o Playwright baixa o Chromium automaticamente (`postinstall`).

Abra [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha quando integrar o Gemini (passo 3):

```
GEMINI_API_KEY=sua_chave_aqui
```

## Stack

- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- Cheerio (parsing HTML)
- Playwright (scraping Amazon — contorna bloqueio de bot/CAPTCHA)
