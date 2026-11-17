// E2E テスト（tests/e2e）で使う DB の接続。環境変数 CARBLE_E2E=1 のときだけ、index.ts の connect がこちらを使う。本番では使わない
//
// SQLite はロックを取れないと、既定では待たずに SQLITE_BUSY で失敗する。
// さらに libsql は SQLITE_BUSY で失敗した文を片付けず、その接続が読み込みのロックを持ち続け、以後ほかの接続の COMMIT がすべて失敗する。
// E2E では、テストの準備で runner が別のプロセスとして DB に直接書き、テストを並列で流すので、これが毎回のように起きる（docs/ISSUES.md「同時に保存すると失敗し、DB がロックされたままになることがある」）。
// そのため、次のようにして失敗させない
// - アプリの中のトランザクションは 1 つずつ順に流す（下の lock）
// - どの接続にも busy_timeout を設定し、ほかのプロセス（runner など）の短いロックは SQLite の中で待つ。
//   待つ間は Node の処理全体が止まるので短くする（アプリの中でぶつかるのは、トランザクションの外の書き込みだけ）
// - それでも失敗したら、接続を張り直して、少し待ってからやり直す
import { createClient, LibsqlError } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

export function connectForE2e(path: string) {
  const client = createClient({ url: path })
  const execute = client.execute.bind(client)
  const batch = client.batch.bind(client)
  const transaction = client.transaction.bind(client)

  // libsql は接続を作るときに busy_timeout を渡せないので、新しい接続を最初に使う前に PRAGMA で設定する。
  // libsql の client は、transaction() で今の接続をトランザクションに渡し、次に使うときに新しい接続を作る。
  // execute() は同期で文を流すので、PRAGMA の直後に同じ接続で次の文が流れる（間に別の処理が入らない）
  let fresh = true
  const prepare = () => {
    if (!fresh) return
    fresh = false
    execute('PRAGMA busy_timeout = 1000').catch(() => fresh = true)
  }
  // 接続を替えたら、間に別の処理が入る前に（同期で）印を付ける
  const reconnect = () => {
    const done = client.reconnect()
    fresh = true
    return done
  }
  // どれも、SQLITE_BUSY のときは何も書き込まれていない（トランザクションの開始・自動コミットの文・中で失敗すると戻す batch）ので、やり直してよい
  client.execute = ((...args: Parameters<typeof execute>) => retryOnBusy(() => {
    prepare()
    return execute(...args)
  }, reconnect)) as typeof client.execute
  client.batch = ((...args: Parameters<typeof batch>) => retryOnBusy(() => {
    prepare()
    return batch(...args)
  }, reconnect)) as typeof client.batch
  client.transaction = (async (...args: Parameters<typeof transaction>) => {
    const tx = await retryOnBusy(() => {
      prepare()
      const pending = transaction(...args)
      // 開始に失敗したときは今の接続のままだが、PRAGMA をもう一度流すだけなので構わない
      fresh = true
      return pending
    }, reconnect)
    // COMMIT は SQLITE_BUSY のときトランザクションが続いているので、そのままやり直してよい
    const commit = tx.commit.bind(tx)
    tx.commit = () => retryOnBusy(commit)
    return tx
  }) as typeof client.transaction

  const db = drizzle({
    schema,
    client,
    logger: process.env.NODE_ENV !== 'production',
  })

  const lock = createLock()
  const dbTransaction = db.transaction.bind(db)
  db.transaction = ((...args: Parameters<typeof dbTransaction>) => lock(() => dbTransaction(...args))) as typeof db.transaction

  return db
}

function createLock() {
  let last: Promise<void> = Promise.resolve()
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    const previous = last
    let release!: () => void
    last = new Promise(resolve => release = resolve)
    try {
      // 前のトランザクションが終わらない（中で待っている処理が終わらない）ときに、後ろがすべて止まらないよう、待つのは 10 秒までにする。
      // 過ぎたら待たずに始め、ロックが取れなければ retryOnBusy で失敗する
      await Promise.race([previous, new Promise(resolve => setTimeout(resolve, 10_000))])
      return await fn()
    }
    finally {
      release()
    }
  }
}

async function retryOnBusy<T>(fn: () => Promise<T>, onBusy?: () => void | Promise<void>): Promise<T> {
  // 10ms から倍にして、合わせて 5 秒ほど待つ
  for (let wait = 10; ; wait *= 2) {
    try {
      return await fn()
    }
    catch (e) {
      if (!(e instanceof LibsqlError && e.code.startsWith('SQLITE_BUSY'))) throw e
      await onBusy?.()
      if (wait > 5_000) throw e
      await new Promise(resolve => setTimeout(resolve, wait))
    }
  }
}
