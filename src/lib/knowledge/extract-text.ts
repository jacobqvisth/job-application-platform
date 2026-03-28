import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

export async function extractTextFromFile(
  buffer: Buffer,
  fileType: string
): Promise<string> {
  const type = fileType.toLowerCase()

  if (type === 'pdf' || type === 'application/pdf') {
    const result = await pdfParse(buffer)
    return result.text
  }

  if (type === 'docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  if (['txt', 'md', 'text/plain', 'text/markdown'].includes(type)) {
    return buffer.toString('utf-8')
  }

  throw new Error(`Unsupported file type: ${type}`)
}
