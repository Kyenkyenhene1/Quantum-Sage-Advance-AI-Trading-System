import { timingSafeEqual } from 'crypto'
import type { NextApiRequest } from 'next'
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

function matchesSecret(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const configuredUsername = process.env.DEV_AUTH_USERNAME
        const configuredPassword = process.env.DEV_AUTH_PASSWORD
        const username = credentials?.username
        const password = credentials?.password

        if (
          !configuredUsername ||
          !configuredPassword ||
          !username ||
          !password ||
          !matchesSecret(username, configuredUsername) ||
          !matchesSecret(password, configuredPassword)
        ) {
          return null
        }

        return { id: username, name: username }
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
}

export type ExecutionIdentity =
  | { ok: true; accountId: string }
  | { ok: false; reason: 'unauthorized' | 'account-not-configured' | 'execution-auth-not-configured' }

function hasValidServerApiKey(req: NextApiRequest, configuredKey: string): boolean {
  const candidates: string[] = []
  const apiKeyHeader = req.headers['x-api-key']
  const authorizationHeader = req.headers.authorization

  if (typeof apiKeyHeader === 'string') candidates.push(apiKeyHeader)
  if (typeof authorizationHeader === 'string') {
    const bearer = authorizationHeader.match(/^Bearer\s+(.+)$/i)
    if (bearer) candidates.push(bearer[1].trim())
  }

  return candidates.some(candidate =>
    candidate.length <= 4096 && matchesSecret(candidate, configuredKey),
  )
}

export function getExecutionIdentity(req: NextApiRequest): ExecutionIdentity {
  const serverKey = process.env.SERVER_SIDE_API_KEY
  const configuredAccountId = process.env.TRADING_ACCOUNT_ID?.trim()

  if (!serverKey || Buffer.byteLength(serverKey) < 32) {
    return { ok: false, reason: 'execution-auth-not-configured' }
  }

  if (!hasValidServerApiKey(req, serverKey)) {
    return { ok: false, reason: 'unauthorized' }
  }

  return configuredAccountId
    ? { ok: true, accountId: configuredAccountId }
    : { ok: false, reason: 'account-not-configured' }
}
