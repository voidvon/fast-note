export function getFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // 最大读取 10MB (前5MB + 后5MB)
    const chunkSize = 5 * 1024 * 1024
    const fileSize = file.size

    // 如果文件小于 10MB，直接读取整个文件
    if (fileSize <= chunkSize * 2) {
      readEntireFile(file, resolve, reject)
      return
    }

    // 否则读取文件的前后部分
    const chunks: ArrayBuffer[] = []

    // 读取文件前部分
    readChunk(file, 0, chunkSize, (frontChunk) => {
      chunks.push(frontChunk)

      // 读取文件后部分
      readChunk(file, fileSize - chunkSize, chunkSize, (endChunk) => {
        chunks.push(endChunk)

        // 合并并计算哈希值
        calculateSHA256(chunks, resolve, reject)
      }, reject)
    }, reject)
  })
}

// 读取整个文件并计算哈希值
function readEntireFile(file: File, resolve: (hash: string) => void, reject: (error: any) => void): void {
  const reader = new FileReader()

  reader.onload = (e) => {
    if (!e.target || !e.target.result) {
      reject(new Error('读取文件失败'))
      return
    }

    const buffer = e.target.result as ArrayBuffer
    calculateSHA256([buffer], resolve, reject)
  }

  reader.onerror = (e) => {
    reject(e)
  }

  reader.readAsArrayBuffer(file)
}

// 读取文件指定位置的块
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

// 使用 Web Crypto API 计算 SHA-256
async function calculateSHA256(
  chunks: ArrayBuffer[],
  resolve: (hash: string) => void,
  reject: (error: any) => void,
): Promise<void> {
  try {
    // 合并所有块
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0)
    const mergedArray = new Uint8Array(totalLength)

    let offset = 0
    for (const chunk of chunks) {
      mergedArray.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }

    // 使用 Web Crypto API 计算 SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', mergedArray)

    // 将 ArrayBuffer 转换为十六进制字符串
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    resolve(hashHex)
  }
  catch (error) {
    reject(error)
  }
}
