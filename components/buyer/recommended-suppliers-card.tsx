"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, MapPin, Star } from "lucide-react"
import Link from "next/link"

type Supplier = {
  id: string
  name: string
  fairScore: number
  rating: number
  reviews: number
  distanceKm: number
  verified: boolean
  role: "seller" | "distributor"
}

export function RecommendedSuppliersCard() {
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  useEffect(() => {
    let cancelled = false
    const loadSuppliers = async () => {
      try {
        const response = await fetch("/api/buyer/suppliers", { credentials: "include", cache: "no-store" })
        const payload = (await response.json()) as { recommended?: Supplier[] }
        if (!cancelled && response.ok && Array.isArray(payload.recommended)) {
          setSuppliers(payload.recommended.slice(0, 3))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    void loadSuppliers()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trusted Suppliers</CardTitle>
        <CardDescription>Fair algorithm recommendations (verified suppliers prioritized)</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading recommendations...
          </div>
        ) : suppliers.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">No supplier recommendations available yet.</p>
        ) : (
          <div className="space-y-4">
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{supplier.name}</p>
                    <Badge variant={supplier.verified ? "default" : "outline"}>
                      {supplier.verified ? "Verified" : "Catalog"}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {supplier.role}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {supplier.rating.toFixed(1)} ({supplier.reviews})
                    </span>
                    <span>Fair {(supplier.fairScore * 100).toFixed(1)}%</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {supplier.distanceKm} km
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Link href="/dashboard/buyer/suppliers">
          <Button variant="outline" className="mt-4 w-full bg-transparent">
            View All Suppliers
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

