export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  images?: string[];
  badge?: string;
  rating?: number;
  reviewCount?: number;
  description?: string;
  colorVariants?: { name: string; hex: string }[];
  sizes?: string[];
  outOfStockSizes?: string[];
  inStock?: boolean;
  brand?: string;
  defaultVariantId?: string | null;
  pdpVariants?: Array<{
    id: string;
    label: string;
    inStock: boolean;
    price?: number;
    stock?: number;
  }>;
}
