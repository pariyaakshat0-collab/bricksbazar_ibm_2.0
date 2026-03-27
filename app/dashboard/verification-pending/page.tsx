"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2 } from "lucide-react"

export default function VerificationPendingPage() {
  const [open, setOpen] = useState(true)
  const [homePopupOpen, setHomePopupOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    const checkApproval = async () => {
      if (!mounted) return
      setChecking(true)
      try {
        const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
        const payload = (await response.json()) as {
          authenticated?: boolean
          user?: { role: "buyer" | "seller" | "distributor" | "admin"; verified: boolean } | null
        }

        if (!mounted || !response.ok || !payload.authenticated || !payload.user) {
          return
        }

        if ((payload.user.role === "seller" || payload.user.role === "distributor") && payload.user.verified) {
          router.replace(`/dashboard/${payload.user.role}`)
        }
      } finally {
        if (mounted) {
          setChecking(false)
        }
      }
    }

    void checkApproval()
    const timer = setInterval(() => {
      void checkApproval()
    }, 20000)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [router])

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dashboard Locked For Verification</DialogTitle>
            <DialogDescription>
              Your seller/distributor account is under admin and ground-level review. This usually takes 1-2 working days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Your registration has been received successfully.</p>
            <p>After verification, your full dashboard access will open automatically.</p>
            <p>If any document update is required, admin will contact you.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setOpen(false)}>I Understand</Button>
          </div>
        </DialogContent>
      </Dialog>

      <h1 className="text-3xl font-bold">Verification Pending</h1>
      <p className="text-muted-foreground">
        Your seller/distributor registration has been received. Dashboard access is temporarily locked until verification is complete.
      </p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        We are checking approval status automatically every 20 seconds.
      </p>
      <div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="bg-transparent" onClick={() => setHomePopupOpen(true)}>
            Back to Home Page
          </Button>
          <Button variant="secondary" onClick={() => router.push("/auth?switch=1")}>
            Switch Account / Sign In
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What Happens Next</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>1. Admin reviews your business details and documents.</p>
          <p>2. Team validates location and trustworthiness at ground level.</p>
          <p>3. Verification typically completes within 1-2 working days.</p>
          <p>4. After approval, seller/distributor dashboard opens automatically.</p>
        </CardContent>
      </Card>

      <AlertDialog open={homePopupOpen} onOpenChange={setHomePopupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go Back To Home Page?</AlertDialogTitle>
            <AlertDialogDescription>
              You can return to the home page now. Your verification request will continue in the background.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay Here</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/auth?switch=1")}>Go To Sign In</AlertDialogAction>
            <AlertDialogAction onClick={() => router.push("/")}>Go To Home</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
