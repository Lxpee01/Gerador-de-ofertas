export type Platform =
  | "amazon"
  | "shopee"
  | "mercadolivre"
  | "aliexpress"
  | "magalu"
  | "unknown";

export interface Product {
  name: string;
  price: string;
  oldPrice?: string;
  imageUrl?: string;
  coupon?: string;
  url: string;
  platform: Platform;
}

export interface ExtractProductResponse {
  success: boolean;
  product?: Product;
  error?: string;
}

export interface GenerateOfferResponse {
  success: boolean;
  offerText?: string;
  error?: string;
}
