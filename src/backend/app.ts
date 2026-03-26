import express, { type Request, type Response } from 'express'
import { ZodError } from 'zod'

import { waitlistSubmissionInputSchema } from './domain/waitlist.js'
import type { WaitlistRepository } from './repository/file-waitlist-repository.js'

export function createApp(waitlistRepository: WaitlistRepository) {
  const app = express()

  app.use(express.json())

  app.get('/api/v1/health', (_request: Request, response: Response) => {
    response.json({ status: 'ok' })
  })

  app.post('/api/v1/waitlist', async (request: Request, response: Response) => {
    try {
      const payload = waitlistSubmissionInputSchema.parse(request.body)
      const submission = await waitlistRepository.create(payload)

      response.status(201).json(submission)
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(422).json({
          message: 'Validation failed.',
          fieldErrors: error.flatten().fieldErrors,
        })
        return
      }

      response.status(500).json({
        message: 'Could not save waitlist submission.',
      })
    }
  })

  return app
}
