export interface BasicAuthUser {
  username: string
  password: string
}

export async function getAllUsers(): Promise<BasicAuthUser[]> {
  return (await useStorage('fs').getItem('basicauth-users.json')) ?? []
}

export async function findUser(username: string, password?: string) {
  const users = await getAllUsers()
  return users.find((user) => {
    return user.username === username && (password === undefined || user.password === password)
  })
}
