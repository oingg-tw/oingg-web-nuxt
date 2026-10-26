// 在 Cloudflare Workers 上跑（2026-10-27，搬遷見 docs/cloudflare-migration-plan.md）：同一份程式也在 App Hosting（Node）跑，
// 平台不同的地方看這一個值。workerd 的 navigator.userAgent 固定是這個字串，Node 是 `Node.js/<版本>`
export const onWorkers = globalThis.navigator?.userAgent === 'Cloudflare-Workers'
