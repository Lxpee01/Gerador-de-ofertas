const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');

function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

async function startPKCEFlow() {
  let env = "";
  try {
    env = fs.readFileSync('.env', 'utf8');
  } catch(e) {
    console.error("❌ Arquivo .env não encontrado.");
    process.exit(1);
  }

  const appIdMatch = env.match(/ML_APP_ID=(.*)/);
  const secretMatch = env.match(/ML_CLIENT_SECRET=(.*)/);

  if (!appIdMatch || !secretMatch) {
    console.error("❌ ML_APP_ID ou ML_CLIENT_SECRET não encontrados no seu .env");
    process.exit(1);
  }

  const appId = appIdMatch[1].trim();
  const secret = secretMatch[1].trim();
  const redirectUri = "https://gerador-de-ofertas-ecru.vercel.app/";

  // Gera o code_verifier e o code_challenge
  const verifier = base64URLEncode(crypto.randomBytes(32));
  const challenge = base64URLEncode(sha256(verifier));

  console.log("======================================================");
  console.log("1. SEGURE CTRL E CLIQUE NO LINK ABAIXO PARA ABRIR:");
  console.log(`https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256`);
  console.log("======================================================");
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\n2. Depois de autorizar, a página vai dar erro (normal). Copie o "TG-..." da URL lá em cima e cole aqui: ', async (code) => {
    rl.close();
    
    // Remove qualquer "code=" se o usuario colou inteiro
    let cleanCode = code.replace("code=", "").trim();

    // Se o usuario esqueceu de copiar o TG-, a gente coloca pra ele
    if (!cleanCode.startsWith("TG-")) {
      cleanCode = "TG-" + cleanCode;
    }

    console.log(`\nGerando token com o código ${cleanCode} ...`);

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', appId);
    params.append('client_secret', secret);
    params.append('code', cleanCode);
    params.append('redirect_uri', redirectUri);
    params.append('code_verifier', verifier);

    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    const data = await response.json();
    
    if (data.refresh_token) {
      console.log("\n✅ SUCESSO! Copie o Refresh Token abaixo e coloque no seu .env e no Vercel:");
      console.log(`\nML_REFRESH_TOKEN=${data.refresh_token}\n`);
    } else {
      console.log(`❌ Erro:`, data.message || data.error);
    }
  });
}

startPKCEFlow().catch(console.error);
