export function getFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunkSize = 5 * 1024 * 1024
    const fileSize = file.size

    if (fileSize <= chunkSize * 2) {
      readEntireFile(file, resolve, reject)
      return
    }

    const chunks: ArrayBuffer[] = []

    readChunk(file, 0, chunkSize, (frontChunk) => {
      chunks.push(frontChunk)

      readChunk(file, fileSize - chunkSize, chunkSize, (endChunk) => {
        chunks.push(endChunk)
        calculateSHA256(chunks, resolve, reject)
      }, reject)
    }, reject)
  })
}

function readEntireFile(file: File, resolve: (hash: string) => void, reject: (error: any) => void): void {
  const reader = new FileReader()

  reader.onload = (e) => {
    if (!e.target || !e.target.result) {
      reject(new Error('读取文件失败'))
      return
    }

    calculateSHA256([e.target.result as ArrayBuffer], resolve, reject)
  }

  reader.onerror = (e) => {
    reject(e)
  }

  reader.readAsArrayBuffer(file)
}

function readChunk(
  file: File,
  start: number,
  size: number,
  onload: (chunk: ArrayBuffer) => void,
  onerror: (error: any) => void,
): void {
  const chunk = file.slice(start, start + size)
  const reader = new FileReader()

  reader.onload = (e) => {
    if (!e.target || !e.target.result) {
      onerror(new Error('读取文件块失败'))
      return
    }

    onload(e.target.result as ArrayBuffer)
  }

  reader.onerror = (e) => {
    onerror(e)
  }

  reader.readAsArrayBuffer(chunk)
}

async function calculateSHA256(
  chunks: ArrayBuffer[],
  resolve: (hash: string) => void,
  reject: (error: any) => void,
): Promise<void> {
  try {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0)
    const mergedArray = new Uint8Array(totalLength)

    let offset = 0
    for (const chunk of chunks) {
      mergedArray.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', mergedArray)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    resolve(hashHex)
  }
  catch (error) {
    reject(error)
  }
}
