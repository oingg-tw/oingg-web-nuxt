// Element Plus erases a table's row type, and this is the one place that says so out loud.
//
// `<el-table :data="rows">` knows what it was given, but its scoped slots type `row` as
// `DefaultRow`（an index signature, effectively `any`）, and there is no way to declare the real
// type at the slot: annotating `#default="{ row }: { row: Stock }"` fails too, because EP's own
// slot signature is `{ row: DefaultRow; column; $index }` and a narrower `row` is not assignable
// to it — tried, 2026-09-23, it adds an error rather than removing two.
//
// So the assertion is unavoidable. What IS avoidable is scattering bare `as Stock` through
// templates where nobody can find them later. Every such cast goes through this function, so
// `grep tableRow` finds all of them, and each call site reads as what it is: a claim that the row
// came from the `:data` we ourselves passed.
//
// It is NOT a way to type arbitrary values. Use it only on a slot's own `row`, in the component
// that owns the matching `:data`.
export function tableRow<T>(row: unknown): T {
  return row as T
}
