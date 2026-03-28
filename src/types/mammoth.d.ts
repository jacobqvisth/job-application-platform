declare module 'mammoth' {
  interface ExtractRawTextOptions {
    buffer?: Buffer
    path?: string
  }
  interface Result {
    value: string
    messages: unknown[]
  }
  export function extractRawText(options: ExtractRawTextOptions): Promise<Result>
}
