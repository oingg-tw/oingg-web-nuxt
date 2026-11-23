// 第三方套件授權清單（2026-11-23，管理站的合規建議，使用者「照建議執行」）：網站的前端 bundle 送到瀏覽器算散布，要附第三方授權聲明，
// echarts 這類套件還有 NOTICE。建置時產生 public/third-party-licenses.txt（不進 git，網址 /third-party-licenses.txt）：正式依賴
//（pnpm licenses list --prod）每個套件的授權名稱，以及 LICENSE、NOTICE 原文。範圍比瀏覽器實際載入的大（含只在伺服器跑的套件），寧可多列。
// package.json 的 build 先跑它；讀不到依賴就讓建置失敗，不送出沒有授權聲明的版本
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'public/third-party-licenses.txt'
const NOTICE_FILE = /^(licen[cs]e|copying|notice)([.-]|$)/i

const byLicense = JSON.parse(execSync('pnpm licenses list --prod --json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
const packages = Object.values(byLicense).flat().sort((a, b) => a.name.localeCompare(b.name))
for (const name of ['vue', 'nuxt', 'echarts', 'element-plus']) {
  if (!packages.some(pkg => pkg.name === name)) throw new Error(`third-party-licenses: ${name} missing from pnpm licenses list`)
}

const sections = packages.map((pkg) => {
  const dir = pkg.paths?.[0]
  const files = dir ? readdirSync(dir).filter(file => NOTICE_FILE.test(file)).sort() : []
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
  const head = [`${pkg.name} ${pkg.versions.join(', ')}`, `License: ${pkg.license}`, pkg.homepage && `Homepage: ${pkg.homepage}`, author && `Author: ${author}`].filter(Boolean).join('\n')
  return [head, ...files.map(file => readFileSync(join(dir, file), 'utf8').trim())].join('\n\n')
})

writeFileSync(OUT, `安盈選股網站使用的第三方套件與授權（建置時自動產生，共 ${packages.length} 個套件）\n\n${sections.join(`\n\n${'='.repeat(72)}\n\n`)}\n`)
console.log(`third-party-licenses: ${packages.length} packages -> ${OUT}`)
