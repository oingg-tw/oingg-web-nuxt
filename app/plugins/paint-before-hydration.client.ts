// 先讓瀏覽器把伺服器輸出的畫面畫出來，再開始接手（hydration）（2026-10-16）。
//
// DEV 的 Lighthouse 手機分數兩極：同一頁有時首次繪製 2.6 秒、有時 5 秒。差在 JS 太早就緒時，瀏覽器先跑完整段 hydration 才畫
// 第一個畫面（實測渲染延遲 0.25 秒對 1.2 秒，模擬手機的 CPU 再乘 4）。這個外掛排在其他外掛與 hydration 之前，讓出一個畫格：
// 伺服器輸出的內容先出現，接手只晚約一個畫格。只在接手伺服器輸出的那一次；之後換頁不經過這裡。
// 背景分頁不會觸發 requestAnimationFrame，所以另外用計時器保底，不會一直卡著不接手。
export default defineNuxtPlugin({
  name: 'paint-before-hydration',
  enforce: 'pre',
  async setup(nuxtApp) {
    if (!nuxtApp.isHydrating) return
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 0))
      setTimeout(resolve, 100)
    })
  }
})
