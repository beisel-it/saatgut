import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from './app.js'
import type { WaitlistSubmission, WaitlistSubmissionInput } from './domain/waitlist.js'
import { FileWaitlistRepository } from './repository/file-waitlist-repository.js'

describe('backend waitlist API', () => {
  it('returns a health payload', async () => {
    const app = createApp({
      create: async () => {
        throw new Error('not used')
      },
    })

    const response = await request(app).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })

  it('persists a valid waitlist submission', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'saatgut-'))
    const dataPath = path.join(tempDir, 'waitlist.json')
    const repository = new FileWaitlistRepository(dataPath)
    const app = createApp(repository)

    const response = await request(app).post('/api/v1/waitlist').send({
      email: 'gardener@example.com',
      interestArea: 'Learning what to plant',
    })

    expect(response.status).toBe(201)
    expect(response.body.email).toBe('gardener@example.com')
    expect(response.body.interestArea).toBe('Learning what to plant')
    expect(response.body.id).toBe(1)

    const savedPayload = await readFile(dataPath, 'utf8')
    expect(JSON.parse(savedPayload)).toMatchObject([
      {
        id: 1,
        email: 'gardener@example.com',
        interestArea: 'Learning what to plant',
      },
    ])
  })

  it('rejects invalid submissions with field errors', async () => {
    const app = createApp({
      create: async () => {
        throw new Error('not used')
      },
    })

    const response = await request(app).post('/api/v1/waitlist').send({
      email: 'not-an-email',
      interestArea: '',
    })

    expect(response.status).toBe(422)
    expect(response.body.message).toBe('Validation failed.')
    expect(response.body.fieldErrors.email).toBeDefined()
    expect(response.body.fieldErrors.interestArea).toBeDefined()
  })

  it('returns a retryable error when persistence fails', async () => {
    const app = createApp({
      create: async (_input: WaitlistSubmissionInput): Promise<WaitlistSubmission> => {
        throw new Error('storage unavailable')
      },
    })

    const response = await request(app).post('/api/v1/waitlist').send({
      email: 'gardener@example.com',
      interestArea: 'Growing food at home',
    })

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      message: 'Could not save waitlist submission.',
    })
  })
})
