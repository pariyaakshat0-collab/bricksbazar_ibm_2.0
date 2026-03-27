"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Users, Shield, Loader2 } from "lucide-react"

type VerificationRequest = {
  requestedRole: "seller" | "distributor"
  businessName: string
  contactPhone: string
  businessAddress: string
  city: string
  state: string
  pincode: string
  gstNumber?: string
  idProofType: string
  idProofNumber: string
  status: "pending" | "approved" | "rejected"
  adminNotes?: string
  reviewedAt?: string
}

type ApiUser = {
  id: string
  name: string
  email: string
  role: "buyer" | "seller" | "distributor" | "admin"
  verified: boolean
  createdAt: string
  verificationRequest?: VerificationRequest | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRole, setSelectedRole] = useState("all")
  const [selectedVerification, setSelectedVerification] = useState("all")
  const [reviewingUserId, setReviewingUserId] = useState<string | null>(null)
  const [reviewNotesByUserId, setReviewNotesByUserId] = useState<Record<string, string>>({})

  const loadUsers = async (cancelled?: { current: boolean }) => {
    try {
      const response = await fetch("/api/admin/users", { credentials: "include", cache: "no-store" })
      const payload = (await response.json()) as { users?: ApiUser[]; error?: string }

      if (!response.ok || !payload.users) {
        throw new Error(payload.error || "Could not load users")
      }

      if (!cancelled?.current) {
        setUsers(payload.users)
      }
    } catch (loadError) {
      if (!cancelled?.current) {
        setError(loadError instanceof Error ? loadError.message : "Could not load users")
      }
    } finally {
      if (!cancelled?.current) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const cancelled = { current: false }

    void loadUsers(cancelled)

    return () => {
      cancelled.current = true
    }
  }, [])

  const reviewRequest = async (user: ApiUser, decision: "approve" | "reject") => {
    setReviewingUserId(user.id)
    setError("")
    setSuccessMessage("")
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: user.id,
          decision,
          adminNotes: reviewNotesByUserId[user.id]?.trim() || undefined,
        }),
      })

      const payload = (await response.json()) as {
        error?: string
        message?: string
        activationNotification?: { sent: number; simulated: number; failed: number }
      }
      if (!response.ok) {
        throw new Error(payload.error || "Could not review request")
      }

      await loadUsers()
      if (decision === "approve") {
        const notice = payload.activationNotification
        const deliverySummary = notice
          ? ` Notifications: sent ${notice.sent}, simulated ${notice.simulated}, failed ${notice.failed}.`
          : ""
        setSuccessMessage(
          payload.message ||
            `${user.name} approved successfully. Seller/Distributor dashboard is now active.${deliverySummary}`,
        )
      } else {
        setSuccessMessage(
          payload.message || `${user.name} rejected successfully. Account remains locked until re-submission.`,
        )
      }
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review request")
    } finally {
      setReviewingUserId(null)
    }
  }

  const roles = ["all", "buyer", "seller", "distributor", "admin"]

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesSearch =
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.id.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesRole = selectedRole === "all" || user.role === selectedRole
        const matchesVerification =
          selectedVerification === "all" ||
          (selectedVerification === "verified" && user.verified) ||
          (selectedVerification === "unverified" && !user.verified)

        return matchesSearch && matchesRole && matchesVerification
      }),
    [users, searchTerm, selectedRole, selectedVerification],
  )

  const roleCount = (role: ApiUser["role"]) => users.filter((user) => user.role === role).length
  const pendingVerificationCount = users.filter((user) => user.verificationRequest?.status === "pending").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Live user directory with role and verification status</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold">{users.filter((user) => user.verified).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Sellers</p>
                <p className="text-2xl font-bold">{roleCount("seller")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Buyers</p>
                <p className="text-2xl font-bold">{roleCount("buyer")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending Reviews</p>
                <p className="text-2xl font-bold">{pendingVerificationCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search users by name, email, or ID..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role} value={role}>
                {role === "all" ? "All Roles" : role.charAt(0).toUpperCase() + role.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedVerification} onValueChange={setSelectedVerification}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Verification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Showing {filteredUsers.length} of {users.length} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-muted-foreground flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No users found for current filters.</div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-start justify-between gap-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{user.name}</h3>
                      <Badge variant={user.verified ? "default" : "secondary"}>
                        {user.verified ? "Verified" : "Unverified"}
                      </Badge>
                      <Badge variant="outline">{user.role}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">ID: {user.id}</p>
                    {user.verificationRequest ? (
                      <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
                        <p>
                          <span className="text-muted-foreground">Business:</span> {user.verificationRequest.businessName}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Location:</span>{" "}
                          {user.verificationRequest.businessAddress}, {user.verificationRequest.city}, {user.verificationRequest.state} -{" "}
                          {user.verificationRequest.pincode}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Contact:</span> {user.verificationRequest.contactPhone}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Proof:</span> {user.verificationRequest.idProofType} |{" "}
                          {user.verificationRequest.idProofNumber}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Request Status:</span>{" "}
                          <Badge
                            variant={
                              user.verificationRequest.status === "approved"
                                ? "default"
                                : user.verificationRequest.status === "rejected"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="ml-1 capitalize"
                          >
                            {user.verificationRequest.status}
                          </Badge>
                        </p>
                        {user.verificationRequest.adminNotes ? (
                          <p>
                            <span className="text-muted-foreground">Admin Notes:</span> {user.verificationRequest.adminNotes}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2 text-right text-sm min-w-[220px]">
                    <div>
                      <p className="text-muted-foreground">Joined</p>
                      <p className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>

                    {user.role !== "buyer" &&
                    user.role !== "admin" &&
                    !user.verified &&
                    user.verificationRequest?.status === "pending" ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="Admin notes (optional)"
                          value={reviewNotesByUserId[user.id] || ""}
                          onChange={(event) =>
                            setReviewNotesByUserId((current) => ({ ...current, [user.id]: event.target.value }))
                          }
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reviewingUserId === user.id}
                            onClick={() => reviewRequest(user, "reject")}
                          >
                            {reviewingUserId === user.id ? "Processing..." : "Reject"}
                          </Button>
                          <Button size="sm" disabled={reviewingUserId === user.id} onClick={() => reviewRequest(user, "approve")}>
                            {reviewingUserId === user.id ? "Processing..." : "Approve & Verify"}
                          </Button>
                        </div>
                      </div>
                    ) : user.role !== "buyer" && user.role !== "admin" ? (
                      <p className="text-xs text-muted-foreground">
                        {user.verificationRequest?.status === "approved"
                          ? "Already approved"
                          : user.verificationRequest?.status === "rejected"
                            ? "Rejected. User must re-submit verification for new review."
                            : "No pending request"}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
