/** Размер распространённых растровых форматов из заголовка, до выделения bitmap. */
export async function imageDimensions(blob: Blob): Promise<{width: number, height: number} | null> {
  const bytes = new Uint8Array(await blob.slice(0, 262144).arrayBuffer())
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, count: number) => String.fromCharCode(...bytes.subarray(offset, offset + count))
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a && ascii(12, 4) === "IHDR") {
    return {width: view.getUint32(16), height: view.getUint32(20)}
  }
  if (bytes.length >= 10 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) {
    return {width: view.getUint16(6, true), height: view.getUint16(8, true)}
  }
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    if (ascii(12, 4) === "VP8X") return {
      width: 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16),
      height: 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16),
    }
    if (ascii(12, 4) === "VP8 " && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
      return {width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff}
    }
    if (ascii(12, 4) === "VP8L" && bytes[20] === 0x2f) return {
      width: 1 + ((bytes[21]! | bytes[22]! << 8) & 0x3fff),
      height: 1 + ((bytes[22]! >> 6 | bytes[23]! << 2 | bytes[24]! << 10) & 0x3fff),
    }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) break
      while (bytes[offset] === 0xff) offset++
      const marker = bytes[offset++]
      if (marker === 0xd9 || marker === 0xda || marker === undefined) break
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue
      if (offset + 2 > bytes.length) break
      const size = view.getUint16(offset)
      if (size < 2 || offset + size > bytes.length) break
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && size >= 7) {
        return {width: view.getUint16(offset + 5), height: view.getUint16(offset + 3)}
      }
      offset += size
    }
  }
  return null
}
