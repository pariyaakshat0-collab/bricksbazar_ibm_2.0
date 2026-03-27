import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { createOrUpdateVerificationRequest, createUser, findUserByEmail } from "@/lib/server/user-store"
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/server/session"
import { getSessionCookieOptions } from "@/lib/server/auth-cookie"

const verificationProfileSchema = z.object({
  businessName: z.string().trim().min(3, "Business name must be at least 3 characters").max(160),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{8,20}$/, "Enter a valid contact phone number"),
  businessAddress: z.string().trim().min(5, "Business address must be at least 5 characters").max(300),
  city: z.string().trim().min(2, "City is required").max(80),
  state: z.string().trim().min(2, "State is required").max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  gstNumber: z.string().trim().min(6).max(30).optional(),
  idProofType: z.string().trim().min(2, "ID proof type is required").max(60),
  idProofNumber: z.string().trim().min(4, "ID proof number is required").max(60),
})

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-Za-z]/, "Password must include at least one letter")
    .regex(/[0-9]/, "Password must include at least one number"),
  role: z.enum(["buyer", "seller", "distributor"]),
  verificationProfile: verificationProfileSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.role !== "buyer" && !value.verificationProfile) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["verificationProfile"],
      message: "Seller/Distributor verification profile is required",
    })
  }
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return NextResponse.json(
        {
          error: firstIssue?.message || "Invalid registration data",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      )
    }

    const name = parsed.data.name.trim()
    const email = parsed.data.email.trim().toLowerCase()
    const password = parsed.data.password
    const role = parsed.data.role

    const existing = await findUserByEmail(email)
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await createUser({ name, email, role, passwordHash })

    if (role === "seller" || role === "distributor") {
      const profile = parsed.data.verificationProfile!
      await createOrUpdateVerificationRequest({
        userId: user.id,
        requestedRole: role,
        businessName: profile.businessName.trim(),
        contactPhone: profile.contactPhone.trim(),
        businessAddress: profile.businessAddress.trim(),
        city: profile.city.trim(),
        state: profile.state.trim(),
        pincode: profile.pincode.trim(),
        gstNumber: profile.gstNumber?.trim() || undefined,
        idProofType: profile.idProofType.trim(),
        idProofNumber: profile.idProofNumber.trim(),
      })

      const token = await createSessionToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        verified: user.verified,
      })

      const response = NextResponse.json(
        {
          requiresApproval: true,
          message:
            "Registration submitted successfully. Your dashboard is locked for review and will be activated in 1-2 working days after admin and ground-level verification.",
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            verified: user.verified,
            createdAt: user.createdAt,
          },
        },
        {
          status: 202,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
        },
      )

      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: token,
        ...getSessionCookieOptions(),
      })

      return response
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      verified: user.verified,
    })

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
          verified: user.verified,
          createdAt: user.createdAt,
        },
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
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
