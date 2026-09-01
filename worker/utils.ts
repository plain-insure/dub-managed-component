// Vendored from managed-component-to-cloudflare-worker (MIT, © Cloudflare) — see ./README.md
export const hasPermission = (
  component: string,
  permission: string,
  permissions: string[]
) => {
  if (!permissions.includes(permission)) {
    console.error(
      `🚨 ${component}: ${permission?.toLocaleUpperCase()} - Permission not granted `
    )
    return false
  }
  return true
}
