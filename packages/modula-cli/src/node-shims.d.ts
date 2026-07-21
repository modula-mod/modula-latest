declare module 'node:fs/promises' {
  export function readFile(path: string | URL, encoding: 'utf8'): Promise<string>
}

declare const process: {
  argv: string[]
  cwd(): string
  exitCode?: number
  stderr: {
    write(message: string): void
  }
  stdout: {
    write(message: string): void
  }
}
