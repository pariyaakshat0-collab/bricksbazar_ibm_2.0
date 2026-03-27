import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { findUserByIdentifier, syncOperatorVerificationState } from "@/lib/server/user-store"
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/server/session"
import { getSessionCookieOptions } from "@/lib/server/auth-cookie"

const loginSchema = z.object({
  identifier: z.string().trim().min(2),
  password: z.string().min(1),
})

const LOGIN_WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS_PER_WINDOW = 8
const BLOCK_FOR_MS = 10 * 60 * 1000

type LoginAttemptState = {
  count: number
  windowStartedAt: number
  blockedUntil: number
}

const loginAttempts = new Map<string, LoginAttemptState>()

function getClientIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")?.trim()
  return forwardedFor || realIp || "unknown"
}

function isBlocked(clientId: string) {
  const attempt = loginAttempts.get(clientId)
  if (!attempt) return false
  if (attempt.blockedUntil <= Date.now()) {
    loginAttempts.delete(clientId)
    return false
  }
  return true
}

function registerFailure(clientId: string) {
  const now = Date.now()
  const current = loginAttempts.get(clientId)

  if (!current || now - current.windowStartedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(clientId, { count: 1, windowStartedAt: now, blockedUntil: 0 })
    return
  }

  const nextCount = current.count + 1
  if (nextCount >= MAX_ATTEMPTS_PER_WINDOW) {
    loginAttempts.set(clientId, {
      count: nextCount,
      windowStartedAt: current.windowStartedAt,
      blockedUntil: now + BLOCK_FOR_MS,
    })
    return
  }

  loginAttempts.set(clientId, { ...current, count: nextCount })
}

function clearFailures(clientId: string) {
  loginAttempts.delete(clientId)
}

export async function POST(request: Request) {
  const clientId = getClientIdentifier(request)

  if (isBlocked(clientId)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in a few minutes." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Retry-After": `${Math.ceil(BLOCK_FOR_MS / 1000)}`,
        },
      },
    )
  }

  try {
    const body = await request.json()
    const normalizedBody = {
      identifier: typeof body?.identifier === "string" ? body.identifier : body?.email,
      password: body?.password,
    }
    const parsed = loginSchema.safeParse(normalizedBody)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid login data" }, { status: 400 })
    }

    const identifier = parsed.data.identifier.trim().toLowerCase()
    const password = parsed.data.password
    const user = await findUserByIdentifier(identifier)

    if (!user) {
      registerFailure(clientId)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      registerFailure(clientId)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    let effectiveUser = user
    let verificationRequest: Awaited<ReturnType<typeof syncOperatorVerificationState>>["request"] = null
    if (user.role === "seller" || user.role === "distributor") {
      const synced = await syncOperatorVerificationState(user.id)
      if (synced.user) {
        effectiveUser = synced.user
      }
      verificationRequest = synced.request
    }

    const isUnverifiedOperator =
      (effectiveUser.role === "seller" || effectiveUser.role === "distributor") && !effectiveUser.verified

    clearFailures(clientId)

    const token = await createSessionToken({
      userId: effectiveUser.id,
      email: effectiveUser.email,
      name: effectiveUser.name,
      role: effectiveUser.role,
      verified: effectiveUser.verified,
    })

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
        requiresApproval: isUnverifiedOperator,
        message: isUnverifiedOperator
          ? verificationRequest?.status === "rejected"
            ? "Your verification request was rejected. Please contact admin to re-submit details."
            : "Your dashboard is locked for verification and should be activated in 1-2 working days."
          : effectiveUser.role === "seller" || effectiveUser.role === "distributor"
            ? "Your account is verified and dashboard is active. You can continue now."
            : undefined,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    )

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      ...getSessionCookieOptions(),
    })

    return response
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
