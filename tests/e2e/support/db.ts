import { createHmac, randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

/**
 * ログインの仕込み。Google OAuth はテストから通せないので、ここだけ DB に直接書く
 * それ以外の前提データは画面か製品の API（support/api.ts）で作る
 */

export const SESSION_COOKIE = 'better-auth.session_token'

export type Account = {
  id: string
  /** ユーザーID。null は未登録（初回ログイン直後） */
  username: string | null
  name: string
  email: string
  /** Cookie better-auth.session_token の値 */
  sessionCookie: string
}

function env(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`環境変数 ${name} がありません（docker-compose.e2e.yml の runner で設定する）`)
  return value
}

function withDb<T>(fn: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(env('DB_PATH'))
  try {
    // app が書いている最中でも待って書けるようにする
    db.exec('PRAGMA busy_timeout = 10000')
    return fn(db)
  } finally {
    db.close()
  }
}

/**
 * Better Auth と同じ方式で Cookie の値に署名する（better-call の signCookieValue）
 * `トークン.署名（HMAC-SHA256 の base64）` を URL エンコードしたもの
 */
function signCookieValue(token: string) {
  const signature = createHmac('sha256', env('BETTER_AUTH_SECRET')).update(token).digest('base64')
  return encodeURIComponent(`${token}.${signature}`)
}

/**
 * ユーザーがメンバーのプロジェクトの、取り込みを待っているインポートを消す
 * インポートは全体で 1 分に 1 件ずつ古い順に取り込まれるので、テストが待たせたまま終わると、後のテストのインポートの取り込みが遅れる
 */
export function deleteOpenImports(userId: string) {
  withDb((db) => {
    db.prepare(`delete from imports where status = 'OPEN' and projectId in (select projectId from usersToProjects where userId = ?)`)
      .run(userId)
  })
}

/** ユーザーと、そのユーザーのログイン状態（セッション）を作る */
export function createAccount(values: { username: string | null, name: string, email: string }): Account {
  const id = randomBytes(16).toString('hex')
  const token = randomBytes(24).toString('base64url')
  const now = Date.now()
  withDb((db) => {
    db.prepare(`insert into users (id, name, email, email_verified, created_at, updated_at, username, display_username)
      values (?, ?, ?, 1, ?, ?, ?, ?)`)
      .run(id, values.name, values.email, now, now, values.username, values.username)
    db.prepare(`insert into sessions (id, expires_at, token, created_at, updated_at, user_id)
      values (?, ?, ?, ?, ?, ?)`)
      .run(randomBytes(16).toString('hex'), now + 7 * 24 * 60 * 60 * 1000, token, now, now, id)
  })
  return { id, ...values, sessionCookie: signCookieValue(token) }
}
