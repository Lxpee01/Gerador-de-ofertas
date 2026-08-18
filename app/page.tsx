"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import type {
  ExtractProductResponse,
  GenerateOfferResponse,
  Product,
} from "@/types/product";

type LoadingStep = "idle" | "extracting" | "generating" | "done";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [loadingStep, setLoadingStep] = useState<LoadingStep>("idle");
  const [product, setProduct] = useState<Product | null>(null);
  const [offerText, setOfferText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [copyingImage, setCopyingImage] = useState(false);

  const [useManualCoupon, setUseManualCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "money">("percent");
  const [discountValue, setDiscountValue] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setProduct(null);
    setOfferText(null);
    setCopied(false);
    setImageCopied(false);
    setLoadingStep("extracting");

    try {
      const extractRes = await fetch("/api/extract-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const extractData: ExtractProductResponse = await extractRes.json();

      if (!extractRes.ok || !extractData.success || !extractData.product) {
        throw new Error(
          extractData.error || "Não consegui extrair os dados desse link.",
        );
      }

      let productForGeneration = extractData.product;
      if (useManualCoupon && couponCode && discountValue) {
        const discountText = discountType === "percent" 
          ? `${discountValue}% de desconto` 
          : `R$ ${discountValue} de desconto`;
        
        productForGeneration = {
          ...productForGeneration,
          coupon: `${couponCode} (${discountText})`
        };
      }

      setProduct(productForGeneration);
      setLoadingStep("generating");

      const offerRes = await fetch("/api/generate-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: productForGeneration, affiliateUrl: url }),
      });

      const offerData: GenerateOfferResponse = await offerRes.json();

      if (!offerRes.ok || !offerData.success || !offerData.offerText) {
        throw new Error(offerData.error || "Erro ao gerar a oferta.");
      }

      setOfferText(offerData.offerText);
      setLoadingStep("done");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Algo deu errado. Tenta novamente.",
      );
      setLoadingStep("idle");
    }
  }

  async function handleCopyImage() {
    if (!product?.imageUrl || copyingImage) return;

    setCopyingImage(true);
    try {
      // Fetch image through our proxy to avoid CORS
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(product.imageUrl)}`;
      const response = await fetch(proxyUrl);
      const blob = await response.blob();

      // Convert to PNG via canvas (clipboard API requires image/png)
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas não suportado"));
            return;
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (b) => {
              if (b) resolve(b);
              else reject(new Error("Falha ao converter imagem"));
            },
            "image/png",
          );
        };
        img.onerror = () => reject(new Error("Falha ao carregar imagem"));
        img.src = URL.createObjectURL(blob);
      });

      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);

      setImageCopied(true);
      setTimeout(() => setImageCopied(false), 2500);
    } catch {
      // Fallback: download the image
      if (product.imageUrl) {
        window.open(product.imageUrl, "_blank");
      }
    } finally {
      setCopyingImage(false);
    }
  }

  async function handleCopy() {
    if (!offerText) return;
    try {
      await navigator.clipboard.writeText(offerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = offerText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function handleReset() {
    setUrl("");
    setProduct(null);
    setOfferText(null);
    setError(null);
    setCopied(false);
    setImageCopied(false);
    setLoadingStep("idle");
  }

  const isLoading =
    loadingStep === "extracting" || loadingStep === "generating";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-12">
      <header className="space-y-2 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-400">
          Gerador de Ofertas
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">
          Crie ofertas em segundos
        </h1>
        <p className="text-zinc-400">
          Cole um link de afiliado para gerar uma oferta pronta para
          compartilhar.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label
          htmlFor="affiliate-url"
          className="block text-sm font-medium text-zinc-300"
        >
          Link de afiliado
        </label>
        <input
          id="affiliate-url"
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://amzn.to/xxxxx ou https://amazon.com.br/dp/..."
          disabled={isLoading}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-50"
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="use-coupon"
            checked={useManualCoupon}
            onChange={(e) => setUseManualCoupon(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-800 bg-zinc-900 text-emerald-500 ring-emerald-500 focus:ring-2"
          />
          <label htmlFor="use-coupon" className="text-sm font-medium text-zinc-300 cursor-pointer select-none">
            Adicionar cupom de desconto
          </label>
        </div>

        {useManualCoupon && (
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Cupom (ex: MEGA10)"
              disabled={isLoading}
              className="w-1/2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-50"
            />
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as "percent" | "money")}
              disabled={isLoading}
              className="w-1/4 rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-3 text-sm text-zinc-100 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-50"
            >
              <option value="percent">%</option>
              <option value="money">R$</option>
            </select>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder="Valor"
              disabled={isLoading}
              className="w-1/4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none ring-emerald-500 transition focus:ring-2 disabled:opacity-50"
            />
          </div>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingStep === "extracting"
            ? "Extraindo dados do produto..."
            : loadingStep === "generating"
              ? "Gerando oferta com IA..."
              : "Gerar oferta"}
        </button>
      </form>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-zinc-400">
            {loadingStep === "extracting"
              ? "Acessando o link e extraindo informações do produto..."
              : "O Gemini está criando uma frase matadora para a sua oferta..."}
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {/* Product preview */}
      {product && (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="mb-4 text-lg font-semibold">Dados do produto</h2>

          <div className="flex flex-col gap-6 sm:flex-row">
            {product.imageUrl ? (
              <div className="group relative mx-auto shrink-0 sm:mx-0">
                <div className="relative h-48 w-48 overflow-hidden rounded-xl bg-zinc-800">
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    unoptimized
                    className="object-contain p-2"
                  />
                </div>
                <button
                  onClick={handleCopyImage}
                  disabled={copyingImage}
                  className={`mt-2 w-48 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    imageCopied
                      ? "bg-emerald-700 text-emerald-100"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                  } disabled:cursor-wait disabled:opacity-60`}
                >
                  {copyingImage
                    ? "Copiando..."
                    : imageCopied
                      ? "Imagem copiada! ✓"
                      : "📋 Copiar imagem"}
                </button>
              </div>
            ) : (
              <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-zinc-800 text-sm text-zinc-500">
                Sem imagem
              </div>
            )}

            <div className="space-y-3 text-sm sm:text-base">
              <p>
                <span className="font-medium text-zinc-400">Plataforma:</span>{" "}
                {product.platform}
              </p>
              <p>
                <span className="font-medium text-zinc-400">Nome:</span>{" "}
                {product.name}
              </p>
              <p>
                <span className="font-medium text-zinc-400">Preço:</span> R${" "}
                {product.price}
                {product.oldPrice && (
                  <span className="ml-2 text-zinc-500 line-through">
                    R$ {product.oldPrice}
                  </span>
                )}
              </p>
              {product.coupon && (
                <p>
                  <span className="font-medium text-zinc-400">Cupom:</span>{" "}
                  {product.coupon}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Generated offer */}
      {offerText && (
        <section className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-emerald-300">
              Oferta pronta 🎉
            </h2>
            <button
              onClick={handleReset}
              className="text-sm text-zinc-400 transition hover:text-zinc-200"
            >
              Nova oferta
            </button>
          </div>

          <pre className="whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm leading-relaxed text-zinc-200">
            {offerText}
          </pre>

          <button
            onClick={handleCopy}
            className={`mt-4 w-full rounded-xl px-4 py-3 font-semibold transition ${
              copied
                ? "bg-emerald-700 text-emerald-100"
                : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
            }`}
          >
            {copied ? "Copiado! ✓" : "Copiar oferta"}
          </button>
        </section>
      )}
    </main>
  );
}
