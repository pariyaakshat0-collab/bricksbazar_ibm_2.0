import crypto from "node:crypto"
import { prisma } from "@/lib/server/prisma"

type NotificationChannel = "email" | "sms"
type NotificationStatus = "queued" | "sent" | "failed" | "simulated"

type ActivationNotificationInput = {
  userId: string
  name: string
  email: string
  role: "seller" | "distributor"
  phone?: string
}

type DispatchResult = {
  channel: NotificationChannel
  status: NotificationStatus
  destination: string
}

let activationNotificationsTableReady = false

async function ensureActivationNotificationsTable() {
  if (activationNotificationsTableReady) return

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS market_operator_activation_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      channel TEXT NOT NULL,
      destination TEXT NOT NULL,
      status TEXT NOT NULL,
      provider TEXT,
      provider_response TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT
    )
  `)

  await prisma.$executeRawUnsafe(
    "CREATE INDEX IF NOT EXISTS market_operator_activation_notifications_user_idx ON market_operator_activation_notifications(user_id)",
  )
  activationNotificationsTableReady = true
}

function sanitizePhone(value?: string) {
  if (!value) return ""
  return value.replace(/[^\d+]/g, "").trim()
}

function buildMessage(input: ActivationNotificationInput) {
  const roleLabel = input.role === "seller" ? "Seller" : "Distributor"
  const subject = `BricksBazar ${roleLabel} Dashboard Activated`
  const message = `Hello ${input.name}, your BricksBazar ${roleLabel.toLowerCase()} dashboard is now activated. Please sign in to start using your account.`
  return { subject, message }
}

async function saveNotificationRow(input: {
  id: string
  userId: string
  role: "seller" | "distributor"
  channel: NotificationChannel
  destination: string
  status: NotificationStatus
  provider: string
  providerResponse?: string
  createdAt: string
  sentAt?: string
}) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO market_operator_activation_notifications
     (id, user_id, role, channel, destination, status, provider, provider_response, created_at, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.id,
    input.userId,
    input.role,
    input.channel,
    input.destination,
    input.status,
    input.provider,
    input.providerResponse ?? null,
    input.createdAt,
    input.sentAt ?? null,
  )
}

async function dispatchViaWebhook(input: {
  channel: NotificationChannel
  destination: string
  userId: string
  role: "seller" | "distributor"
  subject: string
  message: string
}) {
  const webhookUrl =
    input.channel === "email"
      ? (process.env.NOTIFY_EMAIL_WEBHOOK_URL || "").trim()
      : (process.env.NOTIFY_SMS_WEBHOOK_URL || "").trim()
  const webhookToken = (process.env.NOTIFY_WEBHOOK_TOKEN || "").trim()

  if (!webhookUrl) {
    return {
      status: "simulated" as const,
      provider: "mock",
      providerResponse: "Webhook URL not configured",
    }
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
    },
    body: JSON.stringify({
      channel: input.channel,
      destination: input.destination,
      userId: input.userId,
      role: input.role,
      subject: input.subject,
      message: input.message,
    }),
  })

  const rawBody = await response.text()
  if (!response.ok) {
    return {
      status: "failed" as const,
      provider: "webhook",
      providerResponse: rawBody || `HTTP ${response.status}`,
    }
  }

  return {
    status: "sent" as const,
    provider: "webhook",
    providerResponse: rawBody || "ok",
  }
}

async function notifySingleChannel(input: {
  channel: NotificationChannel
  destination: string
  payload: ActivationNotificationInput
  subject: string
  message: string
}) {
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  try {
    const dispatched = await dispatchViaWebhook({
      channel: input.channel,
      destination: input.destination,
      userId: input.payload.userId,
      role: input.payload.role,
      subject: input.subject,
      message: input.message,
    })

    const sentAt = dispatched.status === "sent" ? new Date().toISOString() : undefined
    await saveNotificationRow({
      id,
      userId: input.payload.userId,
      role: input.payload.role,
      channel: input.channel,
      destination: input.destination,
      status: dispatched.status,
      provider: dispatched.provider,
      providerResponse: dispatched.providerResponse,
      createdAt,
      sentAt,
    })

    return {
      channel: input.channel,
      status: dispatched.status,
      destination: input.destination,
    } satisfies DispatchResult
  } catch (error) {
    await saveNotificationRow({
      id,
      userId: input.payload.userId,
      role: input.payload.role,
      channel: input.channel,
      destination: input.destination,
      status: "failed",
      provider: "webhook",
      providerResponse: error instanceof Error ? error.message : "Unknown notification error",
      createdAt,
    })
    return {
      channel: input.channel,
      status: "failed",
      destination: input.destination,
    } satisfies DispatchResult
  }
}

export async function notifyOperatorActivation(input: ActivationNotificationInput) {
  await ensureActivationNotificationsTable()
  const { subject, message } = buildMessage(input)

  const channels: Array<{ channel: NotificationChannel; destination: string }> = []
  if (input.email.trim()) {
    channels.push({ channel: "email", destination: input.email.trim().toLowerCase() })
  }
  const cleanPhone = sanitizePhone(input.phone)
  if (cleanPhone) {
    channels.push({ channel: "sms", destination: cleanPhone })
  }

  const results: DispatchResult[] = []
  for (const channel of channels) {
    const result = await notifySingleChannel({
      channel: channel.channel,
      destination: channel.destination,
      payload: input,
      subject,
      message,
    })
    results.push(result)
  }

  return {
    sent: results.filter((item) => item.status === "sent").length,
    simulated: results.filter((item) => item.status === "simulated").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  }
}
