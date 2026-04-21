export interface CartItem {
  productId: string;
  variationId: string;
  name: string;
  variationName: string;
  price: number; // in cents (individual price)
  quantity: number;
  image?: string;
}

export interface BundleTier {
  id: string;
  name: string;
  item_count: number;
  price_cents: number;
  shipping_eligible: boolean;
  pickup_only: boolean;
  shipping_cost_cents?: number;
}

export interface CartBundle {
  tier: BundleTier;
  items: CartItem[]; // items selected for this bundle
}
