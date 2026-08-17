import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Product } from "@/types/product";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const MODELS = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
const MAX_RETRIES = 2;

async function callGemini(prompt: string): Promise<string> {
  let lastError: Error | null = null;

  for (const modelName of MODELS) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text().trim();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // If 503 (overloaded), wait and retry or try next model
        const is503 = lastError.message.includes("503") || lastError.message.includes("Service Unavailable");
        const is429 = lastError.message.includes("429") || lastError.message.includes("Too Many Requests");

        if (is503 || is429) {
          if (attempt < MAX_RETRIES) {
            // Wait with exponential backoff: 2s, 4s
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            continue;
          }
          // Exhausted retries for this model, try next
          break;
        }

        // For other errors (404, auth, etc), try next model immediately
        break;
      }
    }
  }

  throw lastError || new Error("Não foi possível gerar a oferta. Tente novamente.");
}

export async function generateOfferPhrase(product: Product): Promise<string> {
  const prompt = `Você é um copywriter especialista em ofertas para grupos de WhatsApp/Telegram no Brasil.

Dados do produto:
- Nome: ${product.name}

Gere UMA frase hiper curta (máximo 6 a 10 palavras), MUITO BEM HUMORADA e descontraída sobre o produto. A frase DEVE OBRIGATORIAMENTE ser em LETRAS MAIÚSCULAS (ALL CAPS).

Use o mesmo estilo e nível de descontração destes exemplos reais:
- COLCHÃO DE PRIMEIRA QUALIDADE
- DUAS CAMISAS BOAS SAEM MAIS BARATO QUE UMA RUIM
- CABELO SECO NÃO AGUENTA ESSA
- KIT FECHADO NO PREÇO DE UMA CAMISETA SÓ
- NÃO VAI PRECISAR PEDIR EMPRESTADO MAIS
- CEO DE MEI TAMBÉM MERECE CONFORTO

A frase deve:
- Ser o mais curta e de impacto possível.
- NÃO usar emojis (serão adicionados depois).
- NÃO repetir o nome do produto.
- NÃO incluir preços.

Responda APENAS com a frase (em CAIXA ALTA), sem aspas, sem explicação.`;

  return callGemini(prompt);
}

export function formatOffer(product: Product, phrase: string, affiliateUrl?: string): string {
  const lines: string[] = [];

  lines.push(`🔥 ${phrase}`);
  lines.push("");
  lines.push(`📦 ${product.name}`);
  lines.push("");

  if (product.oldPrice) {
    lines.push(`💰 De ~R$ ${product.oldPrice}~ por *R$ ${product.price}*`);
  } else {
    lines.push(`💰 *R$ ${product.price}*`);
  }

  if (product.coupon) {
    lines.push(`🎟️ Cupom: *${product.coupon}*`);
  }

  lines.push("");
  lines.push(`🛒 Compre aqui: ${affiliateUrl || product.url}`);

  return lines.join("\n");
}
