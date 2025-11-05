export const isValidHttpUrl = (str: string) => {
  let url: URL
  try {
    url = new URL(str)
  } catch {
    return false
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
}

export const getCookie = (
  cookieString: string,
  name: string
): string | undefined => {
  const match = cookieString.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? match[2] : undefined
}
