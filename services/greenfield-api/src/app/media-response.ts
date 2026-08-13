import type {FastifyReply} from 'fastify'

export function applyBrowserVisibleMediaHeaders(reply: FastifyReply): FastifyReply {
  return reply
    .header('Cache-Control', 'private, no-store')
    .header('Cross-Origin-Resource-Policy', 'same-site')
}

export function sendBrowserVisibleMedia(reply: FastifyReply, contentType: string, bytes: Buffer) {
  return applyBrowserVisibleMediaHeaders(reply).type(contentType).send(bytes)
}
