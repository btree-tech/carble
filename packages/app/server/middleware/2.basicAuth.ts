export default defineEventHandler((event) => {
  const authData = useRuntimeConfig().basicAuth
  if (!authData.user || !authData.password) {
    return
  }

  const base64Credentials = event.node.req.headers.authorization?.split(' ')?.[1]
  if (base64Credentials) {
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii')
    const [user, password] = credentials.split(':')

    if (user === authData.user && password === authData.password) {
      return
    }
  }

  setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="Authentication Required"')
  setResponseStatus(event, 401)
  event.node.res.end('Unauthorized')
})
