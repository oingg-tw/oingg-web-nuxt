<script setup lang="ts">
const { visible, close } = useLoginDialog()
const compatAuth = useFirebaseCompatAuth()
// firebaseui ships an `export =` .d.ts that doesn't line up with its ESM runtime export shape.
let authUI: { start: (selector: string, config: unknown) => void; reset: () => void } | null = null

watch(visible, async open => {
  if (!open) return
  await nextTick()

  const [{ auth: firebaseuiAuth }] = await Promise.all([
    import('firebaseui'),
    // @ts-expect-error -- CSS-only import, no type declarations
    import('firebaseui/dist/firebaseui.css')
  ])

  authUI = firebaseuiAuth.AuthUI.getInstance() ?? new firebaseuiAuth.AuthUI(compatAuth)
  authUI.start('#firebaseui-auth-container', {
    signInOptions: ['google.com', 'password'],
    signInFlow: 'popup',
    credentialHelper: 'none',
    callbacks: {
      signInSuccessWithAuthResult: () => {
        close()
        return false
      }
    }
  })
})

function handleClose() {
  close()
  authUI?.reset()
}
</script>

<template>
  <!-- el-dialog teleports to <body> and renders (closed) regardless of login state, so it
       always mounts during SSR too. Vue's SSR renderer buffers teleported content into a
       pass that runs after the rest of the tree, while the client mounts it in normal
       document order — that shifts the shared useId() counter differently on each side and
       can desync id-based siblings that come later (e.g. StockSearchBar's autocomplete).
       Login only ever happens after a click, well after hydration, so deferring this to
       client-only is free. -->
  <ClientOnly>
    <el-dialog v-model="visible" title="登入" width="360" @close="handleClose">
      <div id="firebaseui-auth-container" />
    </el-dialog>
  </ClientOnly>
</template>
