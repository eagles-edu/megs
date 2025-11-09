const QUESTION_FORM_LAYOUTS = [
  {
    id: "response-quad",
    fieldCount: 4,
    description:
      "Four-response layout: four columns on wide screens, two-by-two on medium widths, stack on small screens.",
    defaultFields: ["response", "notes", "confidence", "extension"],
    visuallyHidden: ["Answer A", "Answer B", "Answer C", "Answer D"],
  },
  {
    id: "response-trio",
    fieldCount: 3,
    description:
      "Three-response layout: three columns on wide screens, two up top with one centered below on medium widths, stack on small screens.",
    defaultFields: ["response", "notes", "confidence"],
    visuallyHidden: ["Answer A", "Answer B", "Answer C"],
  },
  {
    id: "response-pair",
    fieldCount: 2,
    description:
      "Two-response layout: two columns on wide screens, single column on small screens.",
    defaultFields: ["response", "notes"],
    visuallyHidden: ["Answer A", "Answer B"],
  },
  {
    id: "response-single",
    fieldCount: 1,
    description: "Single-response layout: always displays at full width.",
    defaultFields: ["response"],
    visuallyHidden: ["Answer A"],
  },
]

const LAYOUT_BY_FIELD_COUNT = new Map(
  QUESTION_FORM_LAYOUTS.map((layout) => [layout.fieldCount, layout])
)

function getLayoutByFieldCount(count) {
  return LAYOUT_BY_FIELD_COUNT.get(Number(count)) || null
}

function getDefaultFieldsForCount(count) {
  const layout = getLayoutByFieldCount(count)
  return layout?.defaultFields ? [...layout.defaultFields] : []
}

function formatHiddenLabel(index) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  if (index >= 0 && index < alphabet.length) {
    return `Answer ${alphabet[index]}`
  }
  return `Answer ${index + 1}`
}

function getHiddenLabel(layoutOrCount, index) {
  const layout =
    typeof layoutOrCount === "number" ? getLayoutByFieldCount(layoutOrCount) : layoutOrCount
  if (!layout) return formatHiddenLabel(index)
  const list = layout.visuallyHidden || []
  return list[index] || formatHiddenLabel(index)
}

export { QUESTION_FORM_LAYOUTS, getDefaultFieldsForCount, getHiddenLabel, getLayoutByFieldCount }
