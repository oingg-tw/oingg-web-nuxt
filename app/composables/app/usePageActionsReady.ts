// Guards a `<Teleport to="#page-actions">` against a real mount-order race: on mobile,
// #page-actions lives inside AppFeatureMenu's el-dialog, which doesn't render its body
// (see that component's own pre-warm comment) until its own onMounted has had a chance to
// run and flush — there's no guarantee that happens before THIS page's Teleport tries to
// resolve its target, since both are relying on independent post-mount async ticks. Vue's
// <Teleport> doesn't retry once it fails to find a target on mount, so the fix has to be on
// this side: don't render the <Teleport> at all until the target is confirmed present.
export function usePageActionsReady() {
  const ready = ref(false)

  onMounted(() => {
    function check() {
      if (document.getElementById('page-actions')) {
        ready.value = true
        return
      }
      requestAnimationFrame(check)
    }
    check()
  })

  return ready
}
