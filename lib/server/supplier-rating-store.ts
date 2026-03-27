import crypto from "node:crypto"
import { prisma } from "@/lib/server/prisma"

export type SupplierOrderRating = {
  id: string
  orderId: string
  buyerId: string
  supplierId: string
  supplierName: string
  rating: number
  reviewText?: string
  createdAt: string
  updatedAt: string
}

export type SupplierRatingStats = {
  supplierId: string
  avgRating: number
  reviewCount: number
  lastRatedAt?: string
}

type SupplierOrderRatingRow = {
  id: string
  order_id: string
  buyer_id: string
  supplier_id: string
  supplier_name: string
  rating: number
  review_text: string | null
  created_at: string
  updated_at: string
}

type SupplierRatingStatsRow = {
  supplier_id: string
  avg_rating: number
  review_count: number
  last_rated_at: string | null
}

let tableReady = false

async function ensureSupplierRatingTable() {
  if (tableReady) return

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS market_supplier_ratings (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      review_text TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(order_id, buyer_id, supplier_id)
    )
  `)

  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS market_supplier_ratings_supplier_idx ON market_supplier_ratings(supplier_id)",
  )
  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS market_supplier_ratings_buyer_idx ON market_supplier_ratings(buyer_id)",
  )
  tableReady = true
}

function mapRow(row: SupplierOrderRatingRow): SupplierOrderRating {
  return {
    id: row.id,
    orderId: row.order_id,
    buyerId: row.buyer_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    rating: Number(row.rating),
    reviewText: row.review_text ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function upsertSupplierOrderRating(input: {
  orderId: string
  buyerId: string
  supplierId: string
  supplierName: string
  rating: number
  reviewText?: string
}) {
  await ensureSupplierRatingTable()
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  await prisma.$executeRawUnsafe(
    `INSERT INTO market_supplier_ratings
     (id, order_id, buyer_id, supplier_id, supplier_name, rating, review_text, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(order_id, buyer_id, supplier_id) DO UPDATE SET
       rating = excluded.rating,
       review_text = excluded.review_text,
       supplier_name = excluded.supplier_name,
       updated_at = excluded.updated_at`,
    id,
    input.orderId,
    input.buyerId,
    input.supplierId,
    input.supplierName,
    input.rating,
    input.reviewText?.trim() || null,
    now,
    now,
  )

  const rows = await prisma.$queryRawUnsafe<SupplierOrderRatingRow[]>(
    `SELECT id, order_id, buyer_id, supplier_id, supplier_name, rating, review_text, created_at, updated_at
     FROM market_supplier_ratings
     WHERE order_id = ? AND buyer_id = ? AND supplier_id = ?
     LIMIT 1`,
    input.orderId,
    input.buyerId,
    input.supplierId,
  )
  return rows.length ? mapRow(rows[0]) : null
}

export async function listSupplierOrderRatingsByOrderIds(orderIds: string[], buyerId?: string) {
  await ensureSupplierRatingTable()
  if (orderIds.length === 0) return []
  const placeholders = orderIds.map(() => "?").join(", ")
  const filterBuyerSql = buyerId ? "AND buyer_id = ?" : ""
  const rows = await prisma.$queryRawUnsafe<SupplierOrderRatingRow[]>(
    `SELECT id, order_id, buyer_id, supplier_id, supplier_name, rating, review_text, created_at, updated_at
     FROM market_supplier_ratings
     WHERE order_id IN (${placeholders})
     ${filterBuyerSql}
     ORDER BY updated_at DESC`,
    ...orderIds,
    ...(buyerId ? [buyerId] : []),
  )
  return rows.map(mapRow)
}

export async function listSupplierRatingStats(supplierIds?: string[]) {
  await ensureSupplierRatingTable()
  const whereSql = supplierIds && supplierIds.length > 0 ? `WHERE supplier_id IN (${supplierIds.map(() => "?").join(", ")})` : ""
  const rows = await prisma.$queryRawUnsafe<SupplierRatingStatsRow[]>(
    `SELECT supplier_id, AVG(rating) as avg_rating, COUNT(1) as review_count, MAX(updated_at) as last_rated_at
     FROM market_supplier_ratings
     ${whereSql}
     GROUP BY supplier_id`,
    ...(supplierIds && supplierIds.length > 0 ? supplierIds : []),
  )

  return rows.map((row) => ({
    supplierId: row.supplier_id,
    avgRating: Number(row.avg_rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    lastRatedAt: row.last_rated_at ?? undefined,
  })) satisfies SupplierRatingStats[]
}

