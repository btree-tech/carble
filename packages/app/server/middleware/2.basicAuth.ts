export default defineEventHandler(async (event) => {
  if (event.path?.startsWith('/api/health')) {
    return
  }

  const authData = useRuntimeConfig().basicAuth
  if (!authData.user || !authData.password) {
    return
  }

  const base64Credentials = event.node.req.headers.authorization?.split(' ')?.[1]
  if (base64Credentials) {
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii')
    const [username, password] = credentials.split(':')

    if (username === authData.user && password === authData.password) return

    // CESCHI-137
    if (!(await getAllUsers()).length) return
    const user = await findUser(username, password)
    if (user) {
      if (event.path.startsWith('/api/projects')) {
        if (event.path === '/api/projects') {
          throw createError({ statusCode: 404, data: { redirectTo: `/projects/${user.username.replace('project-', '')}` } })
        }
        const projectId = event.path.replace(/^\/api\/projects\/([0-9]+).*$/, '$1')
        if (event.path !== '/api/projects' && user.username === `project-${projectId}`) return
      } else if (event.path.startsWith('/projects')) {
        const projectId = event.path.replace(/^\/projects\/([0-9]+).*$/, '$1')
        if (user.username === `project-${projectId}`) return
      } else if (event.path !== '/') {
        return
      } else if (event.path === '/') {
        const projectId = user.username.replace('project-', '')
        await sendRedirect(event, `/projects/${projectId}`)
        return
      }
      throw createError({ statusCode: 404 })
    }
  }

  setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="Authentication Required"')
  setResponseStatus(event, 401)
  event.node.res.end('Unauthorized')
})
