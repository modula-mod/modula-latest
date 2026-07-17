import {loadConfig} from './config/index.js'
import {createServer} from './app/create-server.js'

async function main() {
  const config = loadConfig()
  const {app} = await createServer(config)
  await app.listen({host: config.host, port: config.port})
  app.log.info({host: config.host, port: config.port}, 'Modula API listening')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
