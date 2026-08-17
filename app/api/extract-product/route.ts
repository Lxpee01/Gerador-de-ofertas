import { NextRequest, NextResponse } from "next/server";
import { scrapeAmazon } from "@/lib/scrapers/amazon";
import { scrapeMercadoLivre } from "@/lib/scrapers/mercadolivre";
import { detectPlatform, resolveShortUrl } from "@/lib/scrapers/index";
import type { ExtractProductResponse } from "@/types/product";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const inputUrl = body?.url?.trim();

    if (!inputUrl) {
      return NextResponse.json<ExtractProductResponse>(
        { success: false, error: "Informe um link de afiliado válido." },
        { status: 400 },
      );
    }

    let url: string;
    try {
      url = new URL(inputUrl).toString();
    } catch {
      return NextResponse.json<ExtractProductResponse>(
        { success: false, error: "O link informado não é válido." },
        { status: 400 },
      );
    }

    // Detect platform from original URL first (catches meli.la, amzn.to, etc.)
    let platform = detectPlatform(url);

    // For ML, skip resolveShortUrl (ML scraper handles it internally with Googlebot UA)
    // For others, resolve short URLs and re-detect if needed
    let resolvedUrl = url;
    if (platform !== "mercadolivre") {
      resolvedUrl = await resolveShortUrl(url);
      if (platform === "unknown") {
        platform = detectPlatform(resolvedUrl);
      }
    }

    if (platform === "unknown") {
      return NextResponse.json<ExtractProductResponse>(
        {
          success: false,
          error:
            "Plataforma não reconhecida. Suportamos Amazon e Mercado Livre.",
        },
        { status: 400 },
      );
    }

    let product;

    switch (platform) {
      case "amazon":
        product = await scrapeAmazon(resolvedUrl);
        break;
      case "mercadolivre":
        product = await scrapeMercadoLivre(url);
        break;
      default:
        return NextResponse.json<ExtractProductResponse>(
          {
            success: false,
            error: `Scraper para ${platform} ainda não implementado.`,
          },
          { status: 501 },
        );
    }

    return NextResponse.json<ExtractProductResponse>({
      success: true,
      product,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não consegui extrair os dados desse link, tenta outro.";

    return NextResponse.json<ExtractProductResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
