import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { findUserById, syncOperatorVerificationState } from "@/lib/server/user-store"
import { createSessionToken, SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/server/session"
import { getExpiredSessionCookieOptions, getSessionCookieOptions } from "@/lib/server/auth-cookie"

function unauthorizedResponse(clearCookie = false) {
  const response = NextResponse.json(
    { user: null, authenticated: false },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  )

  if (clearCookie) {
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      ...getExpiredSessionCookieOptions(),
    })
  }

  return response
}

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!token) {
    return unauthorizedResponse(false)
  }

  const payload = await verifySessionToken(token)
  if (!payload) {
    return unauthorizedResponse(true)
  }

  const user = await findUserById(payload.userId)
  if (!user) {
    return unauthorizedResponse(true)
  }

  let effectiveUser = user
  if (user.role === "seller" || user.role === "distributor") {
    const synced = await syncOperatorVerificationState(user.id)
    if (!synced.user) {
      return unauthorizedResponse(true)
    }
    effectiveUser = synced.user
  }

  const response = NextResponse.json(
    {
      user: {
        id: effectiveUser.id,
        email: effectiveUser.email,
        name: effectiveUser.name,
        role: effectiveUser.role,
        avatar: effectiveUser.avatar,
        verified: effectiveUser.verified,
        createdAt: effectiveUser.createdAt,
      },
      authenticated: true,
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  )

  const tokenOutdated =
    payload.userId !== effectiveUser.id ||
    payload.email !== effectiveUser.email ||
    payload.name !== effectiveUser.name ||
    payload.role !== effectiveUser.role ||
    payload.verified !== effectiveUser.verified

  if (tokenOutdated) {
    const refreshedToken = await createSessionToken({
      userId: effectiveUser.id,
      email: effectiveUser.email,
      name: effectiveUser.name,
      role: effectiveUser.role,
      verified: effectiveUser.verified,
    })
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: refreshedToken,
      ...getSessionCookieOptions(),
    })
  }

  return response
}
