import { NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUser } from "@/lib/server/auth-user"
import { notifyOperatorActivation } from "@/lib/server/operator-activation-notifier"
import {
  findUserById,
  getVerificationRequestByUserId,
  listUsers,
  listVerificationRequests,
  reviewVerificationRequest,
} from "@/lib/server/user-store"

const reviewSchema = z.object({
  userId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  adminNotes: z.string().trim().max(500).optional(),
})

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [users, verificationRequests] = await Promise.all([listUsers(), listVerificationRequests()])
  const requestByUserId = new Map(verificationRequests.map((request) => [request.userId, request]))

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      verified: user.verified,
      createdAt: user.createdAt,
      verificationRequest:
        user.role === "seller" || user.role === "distributor" ? requestByUserId.get(user.id) ?? null : null,
    })),
  })
}

export async function PATCH(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = reviewSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review payload" }, { status: 400 })
  }

  const targetUser = await findUserById(parsed.data.userId)
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  if (targetUser.role !== "seller" && targetUser.role !== "distributor") {
    return NextResponse.json({ error: "Only seller/distributor accounts can be reviewed" }, { status: 400 })
  }
  const currentRequest = await getVerificationRequestByUserId(parsed.data.userId)
  if (!currentRequest) {
    return NextResponse.json({ error: "Verification request not found for this user" }, { status: 404 })
  }
  if (currentRequest.status !== "pending") {
    return NextResponse.json(
      { error: `This request is already ${currentRequest.status}. Ask user to re-submit for a new review.` },
      { status: 409 },
    )
  }

  const reviewed = await reviewVerificationRequest({
    userId: parsed.data.userId,
    decision: parsed.data.decision,
    adminId: sessionUser.userId,
    adminNotes: parsed.data.adminNotes,
  })

  if (!reviewed || !reviewed.user || !reviewed.request) {
    return NextResponse.json({ error: "Verification request not found for this user" }, { status: 404 })
  }
  const activationRole = reviewed.user.role === "seller" ? "seller" : "distributor"
  const activationNotification =
    parsed.data.decision === "approve"
      ? await notifyOperatorActivation({
          userId: reviewed.user.id,
          name: reviewed.user.name,
          email: reviewed.user.email,
          role: activationRole,
          phone: reviewed.request.contactPhone,
        })
      : null

  return NextResponse.json({
    user: {
      id: reviewed.user.id,
      name: reviewed.user.name,
      email: reviewed.user.email,
      role: reviewed.user.role,
      verified: reviewed.user.verified,
      createdAt: reviewed.user.createdAt,
    },
    verificationRequest: reviewed.request,
    activationNotification,
    message:
      parsed.data.decision === "approve"
        ? "Account approved. Activation notification sent to registered email/phone."
        : "Account rejected successfully.",
  })
}
