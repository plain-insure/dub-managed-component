// Adapted from managed-component-to-cloudflare-worker (MIT, © Cloudflare) —
// see ./README.md. The only change from upstream is importing our built
// component instead of a copied-in component.js.
import component from '../dist/index.js'
import { handleRequest } from './handler'
import { Env } from './models'

export default {
  async fetch(
    request: Request,
    env: Env,
    execContext: ExecutionContext
  ): Promise<Response> {
    return handleRequest(request, execContext, env, component)
  },
}
