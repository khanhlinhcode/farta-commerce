import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { Request, Response } from "express";
import type { ClientSession, Connection, Model, Types } from "mongoose";
import { Types as MongooseTypes } from "mongoose";

import type { AvailabilityStatus } from "../catalog/catalog.constants";
import { objectId } from "../catalog/catalog.utils";
import { ApiException } from "../common/api-exception";
import type { Environment } from "../config/environment";
import {
  Inventory,
  type InventoryDocument,
} from "../inventory/schemas/inventory.schema";
import {
  MediaAsset,
  type MediaAssetDocument,
} from "../media/schemas/media-asset.schema";
import {
  Product,
  type ProductDocument,
} from "../products/schemas/product.schema";
import {
  ProductVariant,
  type ProductVariantDocument,
} from "../variants/schemas/product-variant.schema";
import type { CartOwner } from "./cart.constants";
import { CartCredentialService } from "./cart-credential.service";
import { Cart, type CartDocument } from "./schemas/cart.schema";

type CartConflict = {
  itemId: string;
  code:
    | "PRODUCT_UNAVAILABLE"
    | "VARIANT_UNAVAILABLE"
    | "OUT_OF_STOCK"
    | "QUANTITY_UNAVAILABLE"
    | "QUANTITY_LIMITED";
};

@Injectable()
export class CartService {
  private readonly maxQuantity: number;
  private readonly guestTtl: number;
  private readonly customerTtl: number;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Cart.name) private readonly carts: Model<CartDocument>,
    @InjectModel(Product.name)
    private readonly products: Model<ProductDocument>,
    @InjectModel(ProductVariant.name)
    private readonly variants: Model<ProductVariantDocument>,
    @InjectModel(Inventory.name)
    private readonly inventories: Model<InventoryDocument>,
    @InjectModel(MediaAsset.name)
    private readonly media: Model<MediaAssetDocument>,
    @Inject(CartCredentialService)
    private readonly credentials: CartCredentialService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.maxQuantity = config.get("CART_MAX_ITEM_QUANTITY", { infer: true });
    this.guestTtl = config.get("GUEST_CART_TTL_SECONDS", { infer: true });
    this.customerTtl = config.get("CUSTOMER_CART_TTL_SECONDS", { infer: true });
  }

  async get(request: Request, response: Response) {
    const owner = this.owner(request, response, true);
    const cart = await this.findOrCreate(owner);
    return this.readModel(cart);
  }

  async add(
    request: Request,
    response: Response,
    variantId: string,
    quantity: number,
  ) {
    this.assertQuantity(quantity);
    await this.assertSellable(variantId, quantity);
    const owner = this.owner(request, response, true);
    const cart = await this.mutate(owner, async (document) => {
      const existing = document.items.find(
        (item) => item.variantId.toString() === variantId,
      );
      const next = (existing?.quantity ?? 0) + quantity;
      this.assertQuantity(next);
      await this.assertSellable(variantId, next);
      if (existing) existing.quantity = next;
      else
        document.items.push({
          _id: new MongooseTypes.ObjectId(),
          variantId: objectId(variantId),
          quantity,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    });
    return this.readModel(cart);
  }

  async update(
    request: Request,
    response: Response,
    itemId: string,
    quantity: number,
  ) {
    this.assertQuantity(quantity);
    const owner = this.owner(request, response, false);
    const cart = await this.mutate(owner, async (document) => {
      const item = document.items.find(({ _id }) => _id.toString() === itemId);
      if (!item) this.itemNotFound();
      await this.assertSellable(item.variantId.toString(), quantity);
      item.quantity = quantity;
      item.updatedAt = new Date();
    });
    return this.readModel(cart);
  }

  async remove(request: Request, response: Response, itemId: string) {
    const owner = this.owner(request, response, false);
    const cart = await this.mutate(owner, (document) => {
      const index = document.items.findIndex(
        ({ _id }) => _id.toString() === itemId,
      );
      if (index < 0) this.itemNotFound();
      document.items.splice(index, 1);
    });
    return this.readModel(cart);
  }

  async clear(request: Request, response: Response) {
    const owner = this.owner(request, response, true);
    const cart = await this.mutate(owner, (document) => {
      document.items.splice(0, document.items.length);
    });
    return this.readModel(cart);
  }

  async merge(request: Request, response: Response) {
    if (!request.principal || request.principal.realm !== "CUSTOMER") {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required.",
      );
    }
    const raw = this.credentials.read(request);
    const customer: CartOwner = {
      type: "CUSTOMER",
      customerId: request.principal.userId,
    };
    if (!raw) return this.readModel(await this.findOrCreate(customer));
    const guestDigest = this.credentials.digest(raw);
    const session = await this.connection.startSession();
    const conflicts: CartConflict[] = [];
    try {
      let targetId: Types.ObjectId | undefined;
      await session.withTransaction(async () => {
        const source = await this.carts
          .findOne({ ownerType: "GUEST", guestCredentialDigest: guestDigest })
          .select("+guestCredentialDigest")
          .session(session);
        if (!source) this.cartNotFound();
        if (source.status === "MERGED") {
          targetId = source.mergedIntoCartId ?? undefined;
          return;
        }
        if (source.status !== "ACTIVE") this.cartNotFound();
        const target = await this.findOrCreate(customer, session);
        for (const sourceItem of source.items) {
          const existing = target.items.find(
            (item) =>
              item.variantId.toString() === sourceItem.variantId.toString(),
          );
          const requested = (existing?.quantity ?? 0) + sourceItem.quantity;
          const quantity = Math.min(requested, this.maxQuantity);
          if (quantity !== requested) {
            conflicts.push({
              itemId: sourceItem._id.toString(),
              code: "QUANTITY_LIMITED",
            });
          }
          if (existing) existing.quantity = quantity;
          else
            target.items.push({
              _id: new MongooseTypes.ObjectId(),
              variantId: sourceItem.variantId,
              quantity,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
        }
        target.expiresAt = this.expiresAt("CUSTOMER");
        await target.save({ session });
        source.status = "MERGED";
        source.mergedIntoCartId = target._id;
        await source.save({ session });
        targetId = target._id;
      });
      if (!targetId) throw new Error("Cart merge did not produce a target.");
      const target = await this.carts.findOne({
        _id: targetId,
        customerId: objectId(request.principal.userId),
        status: "ACTIVE",
      });
      if (!target) this.cartNotFound();
      this.credentials.clear(response);
      const result = await this.readModel(target);
      return { ...result, conflicts: [...result.conflicts, ...conflicts] };
    } finally {
      await session.endSession();
    }
  }

  private owner(
    request: Request,
    response: Response,
    createGuest: boolean,
  ): CartOwner {
    if (request.principal?.realm === "CUSTOMER") {
      return { type: "CUSTOMER", customerId: request.principal.userId };
    }
    let raw = this.credentials.read(request);
    if (!raw && createGuest) raw = this.credentials.issue(response);
    if (!raw) this.cartNotFound();
    return { type: "GUEST", credentialDigest: this.credentials.digest(raw) };
  }

  private async mutate(
    owner: CartOwner,
    mutation: (cart: CartDocument) => void | Promise<void>,
  ): Promise<CartDocument> {
    const session = await this.connection.startSession();
    try {
      let result: CartDocument | undefined;
      await session.withTransaction(async () => {
        const cart = await this.findOrCreate(owner, session);
        await mutation(cart);
        cart.expiresAt = this.expiresAt(owner.type);
        await cart.save({ session });
        result = cart;
      });
      if (!result) throw new Error("Cart mutation did not commit.");
      return result;
    } finally {
      await session.endSession();
    }
  }

  private async findOrCreate(
    owner: CartOwner,
    session?: ClientSession,
  ): Promise<CartDocument> {
    const filter = this.ownerFilter(owner);
    const cart = await this.carts
      .findOneAndUpdate(
        filter,
        {
          $setOnInsert: {
            ownerType: owner.type,
            customerId:
              owner.type === "CUSTOMER" ? objectId(owner.customerId) : null,
            guestCredentialDigest:
              owner.type === "GUEST" ? owner.credentialDigest : null,
            channel: "STOREFRONT",
            currency: "VND",
            status: "ACTIVE",
            items: [],
            expiresAt: this.expiresAt(owner.type),
            mergedIntoCartId: null,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true,
          ...(session ? { session } : {}),
        },
      )
      .exec();
    if (!cart) throw new Error("Cart upsert returned no document.");
    return cart;
  }

  private ownerFilter(owner: CartOwner): Record<string, unknown> {
    return owner.type === "CUSTOMER"
      ? {
          ownerType: "CUSTOMER",
          customerId: objectId(owner.customerId),
          channel: "STOREFRONT",
          currency: "VND",
          status: "ACTIVE",
        }
      : {
          ownerType: "GUEST",
          guestCredentialDigest: owner.credentialDigest,
          channel: "STOREFRONT",
          currency: "VND",
          status: "ACTIVE",
        };
  }

  private async assertSellable(variantId: string, quantity: number) {
    const variant = await this.variants.findOne({
      _id: objectId(variantId),
      status: "ACTIVE",
      archivedAt: null,
    });
    if (!variant) this.variantUnavailable();
    const [product, inventory] = await Promise.all([
      this.products.findOne({
        _id: variant.productId,
        status: "ACTIVE",
        archivedAt: null,
      }),
      this.inventories.findOne({ variantId: variant._id }),
    ]);
    if (!product) this.variantUnavailable();
    if (!inventory || inventory.onHand - inventory.reserved < quantity) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "CART_STOCK_UNAVAILABLE",
        "The requested quantity is unavailable.",
      );
    }
  }

  private async readModel(cart: CartDocument) {
    const variantIds = cart.items.map((item) => item.variantId);
    const variants = await this.variants.find({ _id: { $in: variantIds } });
    const products = await this.products.find({
      _id: { $in: variants.map((variant) => variant.productId) },
    });
    const inventory = await this.inventories.find({
      variantId: { $in: variantIds },
    });
    const mediaIds = products
      .flatMap((product) =>
        product.coverMediaId ? [product.coverMediaId] : [],
      )
      .concat(variants.flatMap((variant) => variant.mediaIds.slice(0, 1)));
    const media = mediaIds.length
      ? await this.media.find({ _id: { $in: mediaIds }, archivedAt: null })
      : [];
    const variantById = new Map(variants.map((item) => [item.id, item]));
    const productById = new Map(products.map((item) => [item.id, item]));
    const inventoryByVariant = new Map(
      inventory.map((item) => [item.variantId.toString(), item]),
    );
    const mediaById = new Map(media.map((item) => [item.id, item]));
    const conflicts: CartConflict[] = [];
    let subtotal = 0;
    const items = cart.items.flatMap((item) => {
      const variant = variantById.get(item.variantId.toString());
      if (!variant) {
        conflicts.push({
          itemId: item._id.toString(),
          code: "VARIANT_UNAVAILABLE",
        });
        return [];
      }
      const product = productById.get(variant.productId.toString());
      const stock = inventoryByVariant.get(variant.id);
      const available = stock ? stock.onHand - stock.reserved : 0;
      const availability: AvailabilityStatus =
        available <= 0
          ? "OUT_OF_STOCK"
          : available <= variant.lowStockThreshold
            ? "LOW_STOCK"
            : "IN_STOCK";
      if (!product || product.status !== "ACTIVE" || product.archivedAt) {
        conflicts.push({
          itemId: item._id.toString(),
          code: "PRODUCT_UNAVAILABLE",
        });
      } else if (variant.status !== "ACTIVE" || variant.archivedAt) {
        conflicts.push({
          itemId: item._id.toString(),
          code: "VARIANT_UNAVAILABLE",
        });
      } else if (available <= 0) {
        conflicts.push({ itemId: item._id.toString(), code: "OUT_OF_STOCK" });
      } else if (available < item.quantity) {
        conflicts.push({
          itemId: item._id.toString(),
          code: "QUANTITY_UNAVAILABLE",
        });
      }
      const lineSubtotal = variant.price * item.quantity;
      if (
        !Number.isSafeInteger(lineSubtotal) ||
        !Number.isSafeInteger(subtotal + lineSubtotal)
      ) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          "CART_MONEY_OVERFLOW",
          "Cart total cannot be calculated safely.",
        );
      }
      subtotal += lineSubtotal;
      const mediaId = variant.mediaIds[0] ?? product?.coverMediaId;
      const asset = mediaId ? mediaById.get(mediaId.toString()) : undefined;
      return [
        {
          id: item._id.toString(),
          quantity: item.quantity,
          product: product
            ? { id: product.id, slug: product.slug, name: product.name }
            : null,
          variant: {
            id: variant.id,
            sku: variant.sku,
            color: variant.color,
            colorCode: variant.colorCode,
            size: variant.size,
          },
          image: asset
            ? {
                id: asset.id,
                secureUrl: asset.secureUrl,
                width: asset.width,
                height: asset.height,
                altText: asset.altText,
              }
            : null,
          unitPrice: variant.price,
          lineSubtotal,
          currency: "VND" as const,
          availability,
        },
      ];
    });
    return {
      id: cart.id,
      status: cart.status,
      currency: cart.currency,
      version: cart.version,
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      items,
      subtotal,
      total: subtotal,
      expiresAt: cart.expiresAt.toISOString(),
      conflicts,
    };
  }

  private expiresAt(ownerType: CartOwner["type"]): Date {
    const ttl = ownerType === "GUEST" ? this.guestTtl : this.customerTtl;
    return new Date(Date.now() + ttl * 1000);
  }

  private assertQuantity(quantity: number): void {
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > this.maxQuantity
    ) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "CART_ITEM_LIMIT",
        "Cart quantity is outside the configured limit.",
      );
    }
  }

  private cartNotFound(): never {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      "CART_NOT_FOUND",
      "Cart was not found.",
    );
  }

  private itemNotFound(): never {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      "CART_ITEM_NOT_FOUND",
      "Cart item was not found.",
    );
  }

  private variantUnavailable(): never {
    throw new ApiException(
      HttpStatus.CONFLICT,
      "CART_VARIANT_UNAVAILABLE",
      "The selected variant is unavailable.",
    );
  }
}
