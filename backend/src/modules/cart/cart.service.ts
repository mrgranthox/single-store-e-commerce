import { Prisma, ProductStatus, VariantStatus } from "@prisma/client";

import { cartEmptyError, notFoundError } from "../../common/errors/app-error";
import { runInTransaction } from "../../common/database/prisma-transaction";
import { prisma } from "../../config/prisma";
import {
  assertCouponCanBeApplied,
  assertVariantCanBeAddedToCart,
  getCartState,
  type CartActorContext,
  resolveCartForContext
} from "./cart.shared";

const purchasableVariantInclude = {
  product: true,
  inventoryStocks: true
} satisfies Prisma.ProductVariantInclude;

export const getCartView = async (context: CartActorContext) => {
  const state = await getCartState(prisma, context);
  return state.evaluation;
};

export const addCartItem = async (
  context: CartActorContext,
  input: {
    variantId: string;
    quantity: number;
  }
) =>
  runInTransaction(async (transaction) => {
    const cart = await resolveCartForContext(transaction, context, {
      createIfMissing: true,
      requireGuestSession: true
    });

    if (!cart) {
      throw cartEmptyError("A cart could not be created for this request.");
    }

    const variant = await transaction.productVariant.findUnique({
      where: {
        id: input.variantId
      },
      include: purchasableVariantInclude
    });

    if (!variant) {
      throw notFoundError("The requested product variant was not found.");
    }

    assertVariantCanBeAddedToCart(variant, input.quantity);

    const existingItem = await transaction.cartItem.findUnique({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: input.variantId
        }
      }
    });

    const nextQuantity = (existingItem?.quantity ?? 0) + input.quantity;
    assertVariantCanBeAddedToCart(variant, nextQuantity);

    if (existingItem) {
      await transaction.cartItem.update({
        where: {
          id: existingItem.id
        },
        data: {
          quantity: nextQuantity,
          unitPriceAmountCentsSnapshot: variant.priceAmountCents,
          unitPriceCurrencySnapshot: variant.priceCurrency
        }
      });
    } else {
      await transaction.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: input.variantId,
          quantity: input.quantity,
          unitPriceAmountCentsSnapshot: variant.priceAmountCents,
          unitPriceCurrencySnapshot: variant.priceCurrency
        }
      });
    }

    return getCartState(transaction, context);
  }).then((state) => state.evaluation);

export const updateCartItemQuantity = async (
  context: CartActorContext,
  input: {
    itemId: string;
    quantity: number;
  }
) =>
  runInTransaction(async (transaction) => {
    const cart = await resolveCartForContext(transaction, context, {
      requireGuestSession: true
    });

    if (!cart) {
      throw notFoundError("The cart item was not found.");
    }

    const item = await transaction.cartItem.findUnique({
      where: {
        id: input.itemId
      },
      include: {
        variant: {
          include: purchasableVariantInclude
        }
      }
    });

    if (!item || item.cartId !== cart.id) {
      throw notFoundError("The cart item was not found.");
    }

    if (item.variant.product.status === ProductStatus.PUBLISHED && item.variant.status === VariantStatus.ACTIVE) {
      assertVariantCanBeAddedToCart(item.variant, input.quantity);
    }

    await transaction.cartItem.update({
      where: {
        id: input.itemId
      },
      data: {
        quantity: input.quantity,
        unitPriceAmountCentsSnapshot: item.variant.priceAmountCents,
        unitPriceCurrencySnapshot: item.variant.priceCurrency
      }
    });

    return getCartState(transaction, context);
  }).then((state) => state.evaluation);

export const removeCartItem = async (
  context: CartActorContext,
  input: {
    itemId: string;
  }
) =>
  runInTransaction(async (transaction) => {
    const cart = await resolveCartForContext(transaction, context, {
      requireGuestSession: true
    });

    if (!cart) {
      throw notFoundError("The cart item was not found.");
    }

    const item = await transaction.cartItem.findUnique({
      where: {
        id: input.itemId
      }
    });

    if (!item || item.cartId !== cart.id) {
      throw notFoundError("The cart item was not found.");
    }

    await transaction.cartItem.delete({
      where: {
        id: input.itemId
      }
    });

    return getCartState(transaction, context);
  }).then((state) => state.evaluation);

export const applyCoupon = async (
  context: CartActorContext,
  input: {
    code: string;
  }
) =>
  runInTransaction(async (transaction) => {
    const cart = await resolveCartForContext(transaction, context, {
      createIfMissing: true,
      requireGuestSession: true
    });

    if (!cart || cart.cartItems.length === 0) {
      throw cartEmptyError("Add at least one item to the cart before applying a coupon.");
    }

    await transaction.cart.update({
      where: {
        id: cart.id
      },
      data: {
        appliedCouponCode: input.code
      }
    });

    const state = await getCartState(transaction, context);
    assertCouponCanBeApplied(state.evaluation.couponOutcome);
    return state;
  }).then((state) => state.evaluation);

export const removeCoupon = async (context: CartActorContext) =>
  runInTransaction(async (transaction) => {
    const cart = await resolveCartForContext(transaction, context, {
      requireGuestSession: true
    });

    if (!cart) {
      throw notFoundError("The cart was not found.");
    }

    await transaction.cart.update({
      where: {
        id: cart.id
      },
      data: {
        appliedCouponCode: null
      }
    });

    return getCartState(transaction, context);
  }).then((state) => state.evaluation);
