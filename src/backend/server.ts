import { createServer } from 'node:http'

import { createApp } from './app.js'
import { getDataPath } from './config.js'
import { FileWaitlistRepository } from './repository/file-waitlist-repository.js'

const port = Number(process.env.PORT ?? 8000)
const repository = new FileWaitlistRepository(getDataPath())
const app = createApp(repository)

createServer(app).listen(port, '127.0.0.1', () => {
  console.log(`Saatgut API listening on http://127.0.0.1:${port}`)
})
