import path from 'node:path'

export function getDataPath(): string {
  return process.env.SAATGUT_DATA_PATH ?? path.join(process.cwd(), 'data', 'waitlist-submissions.json')
}
