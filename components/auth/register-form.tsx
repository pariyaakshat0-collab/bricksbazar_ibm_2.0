"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth, type OperatorVerificationProfile, type RegistrationRole } from "@/lib/auth"
import { Loader2 } from "lucide-react"

interface RegisterFormProps {
  onToggleMode: () => void
}

export function RegisterForm({ onToggleMode }: RegisterFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState<RegistrationRole>("buyer")
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [verificationProfile, setVerificationProfile] = useState<OperatorVerificationProfile>({
    businessName: "",
    contactPhone: "",
    businessAddress: "",
    city: "",
    state: "Madhya Pradesh",
    pincode: "",
    gstNumber: "",
    idProofType: "GST Certificate",
    idProofNumber: "",
  })
  const { register, loading } = useAuth()

  const isOperator = role === "seller" || role === "distributor"

  const updateProfile = (key: keyof OperatorVerificationProfile, value: string) => {
    setVerificationProfile((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccessMessage("")

    if (isOperator) {
      if (!verificationProfile.businessName.trim() || !verificationProfile.businessAddress.trim()) {
        setError("Business name and address are required for seller/distributor verification.")
        return
      }
      if (!verificationProfile.contactPhone.trim() || !verificationProfile.idProofNumber.trim()) {
        setError("Contact phone and ID proof details are required for verification.")
        return
      }
      if (verificationProfile.businessAddress.trim().length < 5) {
        setError("Business address must be at least 5 characters.")
        return
      }
      if (!/^[0-9+\-\s()]{8,20}$/.test(verificationProfile.contactPhone.trim())) {
        setError("Enter a valid contact phone number.")
        return
      }
      if (!/^\d{6}$/.test(verificationProfile.pincode.trim())) {
        setError("Pincode must be 6 digits.")
        return
      }
    }

    try {
      const result = await register(
        email,
        password,
        name,
        role,
        isOperator
          ? {
              ...verificationProfile,
              businessName: verificationProfile.businessName.trim(),
              contactPhone: verificationProfile.contactPhone.trim(),
              businessAddress: verificationProfile.businessAddress.trim(),
              city: verificationProfile.city.trim(),
              state: verificationProfile.state.trim(),
              pincode: verificationProfile.pincode.trim(),
              gstNumber: verificationProfile.gstNumber?.trim() || undefined,
              idProofType: verificationProfile.idProofType.trim(),
              idProofNumber: verificationProfile.idProofNumber.trim(),
            }
          : undefined,
      )
      if (result.requiresApproval) {
        setSuccessMessage(result.message || "Verification request submitted. Please wait for admin approval.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.")
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Create Account</CardTitle>
        <CardDescription className="text-center">Join BricksBazar marketplace today</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Account Type</Label>
            <Select value={role} onValueChange={(value: RegistrationRole) => setRole(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buyer">Buyer - Purchase materials</SelectItem>
                <SelectItem value="seller">Seller - Sell materials</SelectItem>
                <SelectItem value="distributor">Distributor - Handle deliveries</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isOperator ? (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Seller/Distributor Verification Details</p>
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={verificationProfile.businessName}
                  onChange={(e) => updateProfile("businessName", e.target.value)}
                  required={isOperator}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  value={verificationProfile.contactPhone}
                  onChange={(e) => updateProfile("contactPhone", e.target.value)}
                  required={isOperator}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessAddress">Business Address</Label>
                <Input
                  id="businessAddress"
                  value={verificationProfile.businessAddress}
                  onChange={(e) => updateProfile("businessAddress", e.target.value)}
                  required={isOperator}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder="City"
                  value={verificationProfile.city}
                  onChange={(e) => updateProfile("city", e.target.value)}
                  required={isOperator}
                />
                <Input
                  placeholder="State"
                  value={verificationProfile.state}
                  onChange={(e) => updateProfile("state", e.target.value)}
                  required={isOperator}
                />
                <Input
                  placeholder="Pincode"
                  value={verificationProfile.pincode}
                  onChange={(e) => updateProfile("pincode", e.target.value)}
                  required={isOperator}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="GST Number (optional)"
                  value={verificationProfile.gstNumber || ""}
                  onChange={(e) => updateProfile("gstNumber", e.target.value)}
                />
                <Select value={verificationProfile.idProofType} onValueChange={(value) => updateProfile("idProofType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="ID Proof Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GST Certificate">GST Certificate</SelectItem>
                    <SelectItem value="Shop License">Shop License</SelectItem>
                    <SelectItem value="Aadhaar">Aadhaar</SelectItem>
                    <SelectItem value="PAN">PAN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="idProofNumber">ID Proof Number</Label>
                <Input
                  id="idProofNumber"
                  value={verificationProfile.idProofNumber}
                  onChange={(e) => updateProfile("idProofNumber", e.target.value)}
                  required={isOperator}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Seller/Distributor account will be activated only after admin approval and ground-level verification.
              </p>
            </div>
          ) : null}
          {error && <div className="text-sm text-destructive text-center">{error}</div>}
          {successMessage && <div className="text-sm text-green-700 text-center">{successMessage}</div>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <button onClick={onToggleMode} className="text-primary hover:underline font-medium">
            Sign in
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
