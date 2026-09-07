export interface CompanyInfo {
  legalName: string
  // Taiwan's online-sales tax registration rule requires publicly disclosing this alongside
  // the legal entity name (docs/3_audiences/前端工程師/Footer.md §1) — but that requirement
  // presupposes the entity is actually incorporated. Confirmed directly with the user
  // 2026-09-07: 蔓馥金融科技股份有限公司 is the intended name, but incorporation hasn't been
  // filed yet ("還未申請成立"), so no real 統一編號 exists. Stays null rather than a
  // placeholder/guessed number — this app doesn't fabricate legal/regulatory information, and
  // that principle applies at least as strongly here as anywhere else it's followed. Update
  // this the moment a real one is issued; SharedFooter.vue already conditionally hides the
  // whole tax-ID line whenever this is null, so nothing else needs to change.
  taxId: string | null
}

export function useCompanyInfo(): CompanyInfo {
  return {
    legalName: '蔓馥金融科技股份有限公司',
    taxId: null
  }
}
