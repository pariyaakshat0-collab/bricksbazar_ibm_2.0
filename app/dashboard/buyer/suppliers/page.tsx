"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Building2,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShoppingCart,
  Star,
  Verified,
} from "lucide-react"

type Supplier = {
  id: string
  name: string
  role: "seller" | "distributor"
  verified: boolean
  location: string
  distanceKm: number
  rating: number
  reviews: number
  categories: string[]
  specialties: string[]
  description: string
  contact: {
    phone: string
    email: string
  }
  priceRange: "budget" | "mid-range" | "premium"
  minOrder: number
  deliveryTime: string
  fairScore: number
  badges: string[]
}

function getPriceRangeColor(range: Supplier["priceRange"]) {
  if (range === "budget") return "bg-green-100 text-green-800"
  if (range === "mid-range") return "bg-yellow-100 text-yellow-800"
  return "bg-slate-200 text-slate-800"
}

export default function SuppliersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionMessage, setActionMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [recommended, setRecommended] = useState<Supplier[]>([])
  const [favoriteSupplierNames, setFavoriteSupplierNames] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      try {
        const [supplierResponse, favoritesResponse] = await Promise.all([
          fetch("/api/buyer/suppliers", { credentials: "include", cache: "no-store" }),
          fetch("/api/buyer/suppliers/favorites", { credentials: "include", cache: "no-store" }),
        ])

        const [supplierPayload, favoritesPayload] = await Promise.all([
          supplierResponse.json() as Promise<{ suppliers?: Supplier[]; recommended?: Supplier[]; error?: string }>,
          favoritesResponse.json() as Promise<{ supplierNames?: string[] }>,
        ])

        if (!supplierResponse.ok || !supplierPayload.suppliers) {
          throw new Error(supplierPayload.error || "Could not load supplier recommendations")
        }

        if (!cancelled) {
          setSuppliers(supplierPayload.suppliers)
          setRecommended(supplierPayload.recommended || [])
          if (favoritesResponse.ok && Array.isArray(favoritesPayload.supplierNames)) {
            setFavoriteSupplierNames(favoritesPayload.supplierNames)
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load supplier recommendations")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(suppliers.flatMap((supplier) => supplier.categories))).sort()],
    [suppliers],
  )

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const q = searchTerm.trim().toLowerCase()
      const matchesSearch =
        !q ||
        supplier.name.toLowerCase().includes(q) ||
        supplier.specialties.some((specialty) => specialty.toLowerCase().includes(q))
      const matchesCategory = selectedCategory === "all" || supplier.categories.includes(selectedCategory)
      return matchesSearch && matchesCategory
    })
  }, [suppliers, searchTerm, selectedCategory])

  const favoriteSuppliers = useMemo(
    () => filteredSuppliers.filter((supplier) => favoriteSupplierNames.includes(supplier.name)),
    [filteredSuppliers, favoriteSupplierNames],
  )

  const verifiedSuppliers = useMemo(
    () => filteredSuppliers.filter((supplier) => supplier.verified),
    [filteredSuppliers],
  )

  const filteredRecommended = useMemo(
    () => recommended.filter((supplier) => filteredSuppliers.some((item) => item.id === supplier.id)),
    [recommended, filteredSuppliers],
  )

  const toggleFavorite = (supplierName: string) => {
    const isFavorite = favoriteSupplierNames.includes(supplierName)
    const next = isFavorite
      ? favoriteSupplierNames.filter((item) => item !== supplierName)
      : [...favoriteSupplierNames, supplierName]
    setFavoriteSupplierNames(next)

    void fetch("/api/buyer/suppliers/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ supplierName, favorite: !isFavorite }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("favorite update failed")
        const payload = (await response.json()) as { supplierNames?: string[] }
        if (Array.isArray(payload.supplierNames)) {
          setFavoriteSupplierNames(payload.supplierNames)
        }
      })
      .catch(() => {
        setFavoriteSupplierNames((current) =>
          !isFavorite ? current.filter((item) => item !== supplierName) : [...current, supplierName],
        )
      })
  }

  const handleViewProducts = (supplier: Supplier) => {
    const supplierQuery = encodeURIComponent(supplier.name)
    router.push(`/dashboard/buyer/products?supplier=${supplierQuery}`)
    setActionMessage(`Opening products for ${supplier.name}`)
  }

  const handleContactSupplier = (supplier: Supplier) => {
    const subject = encodeURIComponent(`Quote request from BricksBazar buyer`)
    const body = encodeURIComponent(
      `Hello ${supplier.name},\n\nPlease share your latest rates and availability for our MP project requirements.\n\nThanks.`,
    )
    window.location.href = `mailto:${supplier.contact.email}?subject=${subject}&body=${body}`
    setActionMessage(`Opening email composer for ${supplier.name}`)
  }

  const handleCallSupplier = (supplier: Supplier) => {
    if (!supplier.contact.phone.trim()) {
      setActionMessage(`Phone is not available for ${supplier.name}`)
      return
    }
    const normalizedPhone = supplier.contact.phone.replace(/[^0-9+]/g, "")
    window.location.href = `tel:${normalizedPhone}`
    setActionMessage(`Starting call to ${supplier.name}`)
  }

  const SupplierCard = ({ supplier }: { supplier: Supplier }) => (
    <Card className="transition-shadow hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{supplier.name}</h3>
                  {supplier.verified ? <Verified className="h-4 w-4 text-blue-500" /> : null}
                  <Badge variant="outline" className="capitalize">
                    {supplier.role}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {supplier.location} | {supplier.distanceKm} km
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleFavorite(supplier.name)}
                className={favoriteSupplierNames.includes(supplier.name) ? "text-red-500" : "text-muted-foreground"}
              >
                <Heart className={`h-4 w-4 ${favoriteSupplierNames.includes(supplier.name) ? "fill-current" : ""}`} />
              </Button>
            </div>

            <p className="mb-3 text-sm text-muted-foreground">{supplier.description}</p>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{supplier.rating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">({supplier.reviews})</span>
              </div>
              <Badge className={getPriceRangeColor(supplier.priceRange)}>{supplier.priceRange}</Badge>
              <Badge variant="secondary">Fair Score {(supplier.fairScore * 100).toFixed(1)}%</Badge>
              {supplier.verified ? <Badge className="bg-emerald-100 text-emerald-800">Verified</Badge> : null}
            </div>

            <div className="mb-3 flex flex-wrap gap-1">
              {supplier.specialties.slice(0, 3).map((specialty) => (
                <Badge key={specialty} variant="outline" className="text-xs">
                  {specialty}
                </Badge>
              ))}
              {supplier.badges.slice(0, 2).map((badge) => (
                <Badge key={badge} variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              ))}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Delivery: </span>
                <span className="font-medium">{supplier.deliveryTime}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Min Order: </span>
                <span className="font-medium">{supplier.minOrder.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleViewProducts(supplier)}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                View Products
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleContactSupplier(supplier)}>
                <MessageCircle className="mr-2 h-4 w-4" />
                Contact
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleCallSupplier(supplier)}>
                <Phone className="mr-2 h-4 w-4" />
                Call
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Suppliers Directory</h1>
          <p className="text-muted-foreground">Fair algorithm recommendations with verified seller/distributor tags</p>
        </div>
      </div>

      {actionMessage ? <p className="text-sm text-muted-foreground">{actionMessage}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-4">
        <div className="relative min-w-[280px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search suppliers or materials..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category === "all" ? "All Categories" : category}
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All ({filteredSuppliers.length})</TabsTrigger>
          <TabsTrigger value="recommended">Recommended ({filteredRecommended.length})</TabsTrigger>
          <TabsTrigger value="favorites">Favorites ({favoriteSuppliers.length})</TabsTrigger>
          <TabsTrigger value="verified">Verified ({verifiedSuppliers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading supplier directory...
              </CardContent>
            </Card>
          ) : filteredSuppliers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">No suppliers found for current filters.</CardContent>
            </Card>
          ) : (
            filteredSuppliers.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} />)
          )}
        </TabsContent>

        <TabsContent value="recommended" className="space-y-4">
          {filteredRecommended.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">No recommendations available yet.</CardContent>
            </Card>
          ) : (
            filteredRecommended.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} />)
          )}
        </TabsContent>

        <TabsContent value="favorites" className="space-y-4">
          {favoriteSuppliers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">No favorite suppliers yet.</CardContent>
            </Card>
          ) : (
            favoriteSuppliers.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} />)
          )}
        </TabsContent>

        <TabsContent value="verified" className="space-y-4">
          {verifiedSuppliers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">No verified suppliers for current filters.</CardContent>
            </Card>
          ) : (
            verifiedSuppliers.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
