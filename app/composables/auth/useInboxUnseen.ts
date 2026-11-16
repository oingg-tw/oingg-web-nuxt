// 站內信的未讀數（2026-11-16，使用者：「站內信按照建議實作」；設計 https://claude.ai/artifact/EG27Jgn2v1TYyWvymRztqX）：登入後開網站時
// GET /users/me 帶回 user.unseenInboxCount（useEntitlement 原本就會打那一支，不多打一支），打開站內信頁 POST /users/me/inbox/seen 歸零。
// 「帳號」、手機的「選單」與帳號區側欄讀它。程式叫 unseen（上次打開之後才發布的），畫面上寫「未讀」
export const useInboxUnseen = () => useState('inbox-unseen', () => 0)

// 數字太大時寫 99+，徽章不撐寬
export const unseenText = (count: number) => (count > 99 ? '99+' : String(count))
