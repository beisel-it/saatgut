import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { WaitlistSubmission, WaitlistSubmissionInput } from '../domain/waitlist.js'

export interface WaitlistRepository {
  create(input: WaitlistSubmissionInput): Promise<WaitlistSubmission>
}

export class FileWaitlistRepository implements WaitlistRepository {
  constructor(private readonly dataPath: string) {}

  async create(input: WaitlistSubmissionInput): Promise<WaitlistSubmission> {
    const submissions = await this.readAll()
    const nextSubmission: WaitlistSubmission = {
      id: submissions.at(-1)?.id ? submissions.at(-1)!.id + 1 : 1,
      email: input.email,
      interestArea: input.interestArea,
      createdAt: new Date().toISOString(),
    }

    submissions.push(nextSubmission)
    await mkdir(path.dirname(this.dataPath), { recursive: true })
    await writeFile(this.dataPath, JSON.stringify(submissions, null, 2) + '\n', 'utf8')

    return nextSubmission
  }

  private async readAll(): Promise<WaitlistSubmission[]> {
    try {
      const raw = await readFile(this.dataPath, 'utf8')
      const parsed = JSON.parse(raw) as WaitlistSubmission[]
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }

      throw error
    }
  }
}
