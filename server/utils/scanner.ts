import { readdir, readFile, stat } from 'fs/promises'
import { join, extname } from 'path'

const CODE_EXTENSIONS = ['.ts', '.js', '.vue', '.java', '.py', '.go', '.cs', '.kt', '.jsx', '.tsx']
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.nuxt', 'vendor', 'target', '__pycache__', '.idea']

export interface CodeFile {
  path: string
  content: string
}

export interface MicroserviceInfo {
  name: string
  path: string
  fileCount?: number
}

export async function scanMicroserviceCode(basePath: string): Promise<CodeFile[]> {
  const files: CodeFile[] = []

  async function scan(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.includes(entry.name)) {
          await scan(fullPath)
        }
      } else if (entry.isFile() && CODE_EXTENSIONS.includes(extname(entry.name))) {
        const content = await readFile(fullPath, 'utf-8')
        files.push({
          path: fullPath.replace(basePath, ''),
          content
        })
      }
    }
  }

  await scan(basePath)
  return files
}

export async function listMicroservices(directory: string, pattern = 'sil-ms-*'): Promise<MicroserviceInfo[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')

  const microservices: MicroserviceInfo[] = []

  for (const entry of entries) {
    if (entry.isDirectory() && regex.test(entry.name)) {
      const msPath = join(directory, entry.name)
      microservices.push({
        name: entry.name,
        path: msPath
      })
    }
  }

  return microservices
}

export async function getMicroservicePath(directory: string, name: string): Promise<string | null> {
  const msPath = join(directory, name)
  try {
    const stats = await stat(msPath)
    if (stats.isDirectory()) {
      return msPath
    }
  } catch {
    return null
  }
  return null
}
