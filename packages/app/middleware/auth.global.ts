const allowlist = [
  'login',
]

export default defineNuxtRouteMiddleware(async (to) => {
  if (allowlist.includes(String(to.name))) return

  const { data: session } = await authClient.useSession(useFetch)
  if (!session.value) {
    return navigateTo('/login')
  }
  if (to.name !== 'users-new' && !session.value.user.username) {
    return navigateTo('/users/new')
  }
})
