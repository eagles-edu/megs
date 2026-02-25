#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { PrismaClient } from "@prisma/client"

function parseArgs(argv) {
  const args = {
    input: "schemas/member-intake-cf3.schema.json",
    formId: "cf3",
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === "--input") args.input = argv[i + 1] || args.input
    if (token === "--form-id") args.formId = argv[i + 1] || args.formId
  }
  return args
}

function normalizeControlType(control) {
  const value = String(control || "")
    .trim()
    .toLowerCase()
  if (
    value === "text" ||
    value === "textarea" ||
    value === "number" ||
    value === "email" ||
    value === "select" ||
    value === "checkbox" ||
    value === "radio" ||
    value === "date"
  ) {
    return value
  }
  if (value === "meta") return "meta"
  return "unknown"
}

function toFieldKey(field, fallbackIndex) {
  if (Number.isInteger(field?.key)) return field.key
  const raw = Number.parseInt(String(field?.keyRaw || ""), 10)
  if (Number.isInteger(raw)) return raw
  return 100000 + fallbackIndex
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const inputPath = path.resolve(args.input)
  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"))
  const fields = Array.isArray(payload?.fields) ? payload.fields : []
  if (!fields.length) {
    throw new Error(`No fields found in schema: ${inputPath}`)
  }

  const prisma = new PrismaClient()
  await prisma.$connect()

  let upserts = 0
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i]
    const fieldKey = toFieldKey(field, i)
    const dataName = String(field?.dataName || "").trim() || `group-${i}`
    const label = String(field?.label || "").trim() || null
    const controlType = normalizeControlType(field?.control)
    const required = Boolean(field?.required)
    const sourceOrder = Number.isInteger(field?.sourceOrder) ? field.sourceOrder : i
    const optionsJson = Array.isArray(field?.options) ? field.options : null
    const metadataJson = {
      dataType: field?.dataType || "",
      control: field?.control || "",
      name: field?.name || "",
      placeholder: field?.placeholder || null,
      keyRaw: field?.keyRaw || "",
    }

    await prisma.intakeFieldDefinition.upsert({
      where: {
        formId_fieldKey: {
          formId: args.formId,
          fieldKey,
        },
      },
      update: {
        dataName,
        label,
        controlType,
        required,
        sourceOrder,
        optionsJson,
        metadataJson,
      },
      create: {
        formId: args.formId,
        fieldKey,
        dataName,
        label,
        controlType,
        required,
        sourceOrder,
        optionsJson,
        metadataJson,
      },
    })
    upserts += 1
  }

  await prisma.$disconnect()
  console.log(`Seeded intake field definitions: formId=${args.formId} upserts=${upserts}`)
}

main().catch(async (error) => {
  console.error(`seed-member-intake-field-definitions failed: ${error.message}`)
  process.exit(1)
})
