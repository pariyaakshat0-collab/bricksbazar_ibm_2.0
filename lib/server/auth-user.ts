import { cookies } from "next/headers"
import type { UserRole } from "@/lib/auth"
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/server/session"
import { findUserById, syncOperatorVerificationState } from "@/lib/server/user-store"

export type SessionUser = {
  userId: string
  email: string
  name: string
  role: UserRole
  verified: boolean
  pendingRole?: "seller" | "distributor"
}

export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifySessionToken(token)
  if (!payload) return null

  const user = await findUserById(payload.userId)
  if (!user) return null

  let effectiveUser = user
  if (user.role === "seller" || user.role === "distributor") {
    const synced = await syncOperatorVerificationState(user.id)
    if (!synced.user) return null
    effectiveUser = synced.user
  }

  if ((effectiveUser.role === "seller" || effectiveUser.role === "distributor") && !effectiveUser.verified) {
    return {
      userId: effectiveUser.id,
      email: effectiveUser.email,
      name: effectiveUser.name,
      role: "buyer",
      verified: false,
      pendingRole: effectiveUser.role,
    } satisfies SessionUser
  }

  return {
    userId: effectiveUser.id,
    email: effectiveUser.email,
    name: effectiveUser.name,
    role: effectiveUser.role,
    verified: effectiveUser.verified,
  } satisfies SessionUser
}
