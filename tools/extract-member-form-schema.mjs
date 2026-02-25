#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { execFileSync } from "node:child_process"
import * as cheerio from "cheerio"

function clean(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
}

function parseArgs(argv) {
  const args = {
    input: "",
    output: "",
    wrapperId: "cf_3",
    formId: "cf3",
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === "--input") args.input = argv[i + 1] || ""
    if (token === "--output") args.output = argv[i + 1] || ""
    if (token === "--wrapper-id") args.wrapperId = argv[i + 1] || ""
    if (token === "--form-id") args.formId = argv[i + 1] || ""
  }

  return args
}

async function readInput(input) {
  if (!input) throw new Error("Missing --input")
  if (/^https?:\/\//i.test(input)) {
    try {
      const response = await fetch(input, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        },
      })
      if (!response.ok) throw new Error(`Failed to fetch input: HTTP ${response.status}`)
      return response.text()
    } catch (fetchError) {
      try {
        const stdout = execFileSync(
          "curl",
          [
            "-L",
            "--max-time",
            "30",
            "-A",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            input,
          ],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
        )
        return stdout
      } catch (curlError) {
        throw new Error(
          `Unable to fetch input URL via fetch or curl: ${fetchError.message}; ${curlError.message}`
        )
      }
    }
  }
  return fs.readFileSync(input, "utf8")
}

function extractSchema(html, wrapperId, formId) {
  const $ = cheerio.load(html)
  const wrapper = $(`#${wrapperId}`)
  const form = wrapper.find(`form#${formId}`).first()
  if (!form.length) throw new Error(`Form not found: wrapper=#${wrapperId}, form=#${formId}`)

  const fields = []

  form.find(".cf-control-group").each((index, groupEl) => {
    const group = $(groupEl)
    const key = group.attr("data-key") || ""
    const dataName = group.attr("data-name") || ""
    const dataLabel = group.attr("data-label") || ""
    const dataType = group.attr("data-type") || ""
    const label = clean(group.find(".cf-label").first().text() || dataLabel)
    const required = group.is("[data-required]") || group.find("[required]").length > 0

    if (["heading", "divider", "html"].includes(dataType)) {
      fields.push({
        sourceOrder: index,
        key: key ? Number.parseInt(String(key), 10) : null,
        keyRaw: key,
        dataName,
        label,
        dataType,
        control: "meta",
        required,
        name: "",
        placeholder: null,
        options: null,
      })
      return
    }

    const controls = group
      .find("input, select, textarea")
      .filter((_, el) => clean($(el).attr("type") || "").toLowerCase() !== "hidden")

    if (!controls.length) {
      fields.push({
        sourceOrder: index,
        key: key ? Number.parseInt(String(key), 10) : null,
        keyRaw: key,
        dataName,
        label,
        dataType,
        control: "unknown",
        required,
        name: "",
        placeholder: null,
        options: null,
      })
      return
    }

    const first = controls.first()
    const tag = clean(first.prop("tagName") || "").toLowerCase()
    const control = tag === "input" ? clean(first.attr("type") || "text").toLowerCase() : tag
    const name = first.attr("name") || ""
    const placeholder = clean(first.attr("placeholder") || "") || null
    let options = null

    if (tag === "select") {
      options = []
      first.find("option").each((_, opt) => {
        options.push({
          value: $(opt).attr("value") || "",
          label: clean($(opt).text()),
        })
      })
    } else if (control === "checkbox" || control === "radio") {
      options = []
      controls.each((_, controlEl) => {
        const field = $(controlEl)
        const id = field.attr("id") || ""
        options.push({
          value: field.attr("value") || "",
          label: clean(group.find(`label[for="${id}"]`).first().text()),
        })
      })
    }

    fields.push({
      sourceOrder: index,
      key: key ? Number.parseInt(String(key), 10) : null,
      keyRaw: key,
      dataName,
      label,
      dataType,
      control,
      required,
      name,
      placeholder,
      options,
    })
  })

  return {
    extractedAt: new Date().toISOString(),
    wrapperId,
    formId,
    fieldGroupsTotal: fields.length,
    fieldInputsTotal: fields.filter((entry) => entry.control !== "meta").length,
    requiredFieldInputsTotal: fields.filter((entry) => entry.control !== "meta" && entry.required)
      .length,
    fields,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.input || !args.output) {
    console.error(
      "Usage: node tools/extract-member-form-schema.mjs --input <file-or-url> --output <json-file> [--wrapper-id cf_3] [--form-id cf3]"
    )
    process.exit(1)
  }

  const html = await readInput(args.input)
  const schema = extractSchema(html, args.wrapperId, args.formId)
  const outPath = path.resolve(args.output)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`, "utf8")
  console.log(`Wrote schema: ${outPath}`)
  console.log(
    `fields=${schema.fieldGroupsTotal} inputFields=${schema.fieldInputsTotal} requiredInputs=${schema.requiredFieldInputsTotal}`
  )
}

main().catch((error) => {
  console.error(`extract-member-form-schema failed: ${error.message}`)
  process.exit(1)
})
