import type { Price } from '../schemas/catalogue';

type PriceTerms = Pick<
  Price,
  | 'priceCents'
  | 'memberPriceCents'
  | 'promoType'
  | 'promoQty'
  | 'promoPriceCents'
  | 'promoFreeQty'
  | 'promoMemberOnly'
>;

/**
 * What `qty` items cost under these price terms, in cents.
 *
 * - The member price applies only if the shopper holds the chain's loyalty card.
 * - Multibuys ("3 for R50") and buy-X-get-Y apply only to complete bundles; leftovers pay the
 *   single-item price. A promo is never used if buying singly would be cheaper.
 * - Member-only promos need the card.
 */
export function lineCost(terms: PriceTerms, qty: number, hasCard: boolean): number {
  if (qty <= 0) return 0;
  const single =
    hasCard && terms.memberPriceCents !== null ? terms.memberPriceCents : terms.priceCents;
  const plain = single * qty;
  if (terms.promoMemberOnly && !hasCard) return plain;

  switch (terms.promoType) {
    case 'none':
      return plain;
    case 'multibuy': {
      if (terms.promoQty === null || terms.promoPriceCents === null) return plain;
      const bundles = Math.floor(qty / terms.promoQty);
      const rest = qty - bundles * terms.promoQty;
      return Math.min(plain, bundles * terms.promoPriceCents + rest * single);
    }
    case 'buy_x_get_y': {
      if (terms.promoQty === null || terms.promoFreeQty === null) return plain;
      const group = terms.promoQty + terms.promoFreeQty;
      const free = Math.floor(qty / group) * terms.promoFreeQty;
      return (qty - free) * single;
    }
  }
}

/** Short label for a special, e.g. `3 for R50.00`, `Buy 2 get 1 free`. */
export function describePromo(terms: PriceTerms, format: (cents: number) => string): string | null {
  switch (terms.promoType) {
    case 'none':
      return null;
    case 'multibuy':
      return terms.promoQty !== null && terms.promoPriceCents !== null
        ? `${terms.promoQty} for ${format(terms.promoPriceCents)}`
        : null;
    case 'buy_x_get_y':
      return terms.promoQty !== null && terms.promoFreeQty !== null
        ? `Buy ${terms.promoQty} get ${terms.promoFreeQty} free`
        : null;
  }
}
