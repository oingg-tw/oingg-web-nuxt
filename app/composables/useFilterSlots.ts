import type { FilterCriterion } from '~/composables/useFilterSearch'

export interface FilterSlot {
  id: number
  fieldId: string | null
  fieldLabel: string | null
  min: number | null
  max: number | null
  exclude: boolean
}

const INITIAL_SLOT_COUNT = 6

function createSlot(id: number): FilterSlot {
  return { id, fieldId: null, fieldLabel: null, min: null, max: null, exclude: false }
}

// Each slot is an independent condition card, not tied to a fixed metric — the user
// picks which indicator a slot filters on via StockFilterIndicatorDialog. Grid layout
// (not a per-field checkbox list) keeps the page height bounded regardless of how many
// metrics the schema ends up with.
export function useFilterSlots() {
  const slots = ref<FilterSlot[]>(Array.from({ length: INITIAL_SLOT_COUNT }, (_, index) => createSlot(index)))
  let nextId = INITIAL_SLOT_COUNT

  function addSlot() {
    slots.value.push(createSlot(nextId++))
  }

  function clearSlot(id: number) {
    const slot = slots.value.find(item => item.id === id)
    if (!slot) return
    slot.fieldId = null
    slot.fieldLabel = null
    slot.min = null
    slot.max = null
    slot.exclude = false
  }

  function setSlotField(id: number, fieldId: string, fieldLabel: string) {
    const slot = slots.value.find(item => item.id === id)
    if (!slot) return
    slot.fieldId = fieldId
    slot.fieldLabel = fieldLabel
  }

  const criteria = computed<FilterCriterion[]>(() =>
    slots.value
      .filter((slot): slot is FilterSlot & { fieldId: string } => slot.fieldId !== null)
      .map(slot => ({ field: slot.fieldId, min: slot.min, max: slot.max, exclude: slot.exclude }))
  )

  return { slots, addSlot, clearSlot, setSlotField, criteria }
}
