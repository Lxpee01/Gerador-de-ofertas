import { NextRequest, NextResponse } from "next/server";
import { generateOfferPhrase, formatOffer } from "@/lib/gemini";
import type { Product, GenerateOfferResponse } from "@/types/product";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const product = body?.product as Product | undefined;
    const affiliateUrl = body?.affiliateUrl as string | undefined;

    if (!product || !product.name || !product.price || !product.url) {
      return NextResponse.json<GenerateOfferResponse>(
        { success: false, error: "Dados do produto incompletos." },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json<GenerateOfferResponse>(
        {
          success: false,
          error: "Chave da API Gemini não configurada. Adicione GEMINI_API_KEY no .env",
        },
        { status: 500 },
      );
    }

    const phrase = await generateOfferPhrase(product);
    const offerText = formatOffer(product, phrase, affiliateUrl);

    return NextResponse.json<GenerateOfferResponse>({
      success: true,
      offerText,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro ao gerar a oferta. Tente novamente.";

    return NextResponse.json<GenerateOfferResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
