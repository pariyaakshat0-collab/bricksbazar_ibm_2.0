import { NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/lib/server/auth-user"
import { listOrders } from "@/lib/server/market-store"
import { upsertSupplierOrderRating } from "@/lib/server/supplier-rating-store"

const ratingSchema = z.object({
  supplierId: z.string().trim().min(1).optional(),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().max(500).optional(),
})

export async function POST(request: Request, { params }: { params: { orderId: string } }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "buyer") {
    return NextResponse.json({ error: "Only buyers can submit ratings" }, { status: 403 })
  }

  const parsed = ratingSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rating payload" }, { status: 400 })
  }

  const orders = await listOrders()
  const order = orders.find((item) => item.id === params.orderId)
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }
  if (order.buyerId !== sessionUser.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (order.status !== "delivered") {
    return NextResponse.json({ error: "Rating can be submitted only after delivery" }, { status: 409 })
  }

  const sellerById = new Map<string, string>()
  for (const item of order.items) {
    if (!sellerById.has(item.sellerId)) {
      sellerById.set(item.sellerId, item.sellerName)
    }
  }

  const requestedSupplierId = parsed.data.supplierId?.trim()
  const fallbackSupplierId = order.sellerId && order.sellerId !== "multi-seller" ? order.sellerId : Array.from(sellerById.keys())[0]
  const supplierId = requestedSupplierId || fallbackSupplierId
  if (!supplierId) {
    return NextResponse.json({ error: "Supplier mapping not found for this order" }, { status: 400 })
  }

  const supplierName = sellerById.get(supplierId) || (order.sellerId === supplierId ? order.sellerName : undefined)
  if (!supplierName) {
    return NextResponse.json({ error: "Selected supplier does not belong to this order" }, { status: 400 })
  }

  const saved = await upsertSupplierOrderRating({
    orderId: order.id,
    buyerId: sessionUser.userId,
    supplierId,
    supplierName,
    rating: parsed.data.rating,
    reviewText: parsed.data.reviewText?.trim() || undefined,
  })

  return NextResponse.json({ rating: saved }, { status: 201 })
}

