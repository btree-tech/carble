import { request, type APIRequestContext } from '@playwright/test'
import { SESSION_COOKIE, type Account } from './db'

export type Project = { id: number, name: string }
export type Field = { id: number, name: string, order: number, isVisible: boolean }
export type Card = { id: number, order: number }

/**
 * 製品の API を、あるユーザーのログイン状態で呼ぶ（前提データの作成）
 * 画面で確かめる操作そのものには使わない
 */
export class ProductApi {
  private constructor(private readonly context: APIRequestContext) {}

  static async as(account: Account) {
    const context = await request.newContext({
      baseURL: process.env.BASE_URL,
      extraHTTPHeaders: { cookie: `${SESSION_COOKIE}=${account.sessionCookie}` },
    })
    return new ProductApi(context)
  }

  async dispose() {
    await this.context.dispose()
  }

  /** 製品の API を呼ぶ。2xx 以外はエラーにする。決まった操作は下のメソッドを使う */
  async call<T>(method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown): Promise<T> {
    const response = await this.context[method](path, data === undefined ? undefined : { data })
    if (!response.ok()) throw new Error(`${method.toUpperCase()} ${path}: ${response.status()} ${await response.text()}`)
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  /** プロジェクトを作る（自分がオーナー）。fields: true で初期の項目「みだし」「メモ」も作る */
  async createProject(name: string, options: { fields?: boolean } = { fields: true }) {
    return await this.call<Project>('post', '/api/projects', { name, fields: options.fields })
  }

  async fields(projectId: number) {
    const project = await this.call<{ fields: Field[] }>('get', `/api/projects/${projectId}`)
    return project.fields
  }

  async addField(projectId: number, name: string) {
    return await this.call<Field>('post', `/api/projects/${projectId}/fields`, { name })
  }

  async setFieldVisible(projectId: number, fieldId: number, isVisible: boolean) {
    await this.call('put', `/api/projects/${projectId}/fields/${fieldId}`, { isVisible })
  }

  /** カードを末尾に追加する。values は項目名ごとの値 */
  async addCard(projectId: number, values: Record<string, string> = {}) {
    const card = await this.call<Card>('post', `/api/projects/${projectId}/cards`, {})
    const fields = await this.fields(projectId)
    for (const [name, body] of Object.entries(values)) {
      const field = fields.find((f) => f.name === name)
      if (!field) throw new Error(`項目「${name}」がありません`)
      await this.call('put', `/api/projects/${projectId}/cards/${card.id}/fields/${field.id}`, { body })
    }
    return card
  }

  /** ユーザーを招待する（オーナーで呼ぶ） */
  async invite(projectId: number, username: string) {
    await this.call('post', `/api/projects/${projectId}/users`, { username, status: 'invited' })
  }

  /** 自分への招待を承認する（招待されたユーザーで呼ぶ） */
  async accept(projectId: number, userId: string) {
    await this.call('put', `/api/projects/${projectId}/users/${userId}`, { status: null })
  }
}
