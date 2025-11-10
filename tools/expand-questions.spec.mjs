import { describe, it } from "node:test"
import assert from "node:assert/strict"
import * as cheerio from "cheerio"
import { ensureInteractiveScaffold, processHtml } from "../tools/expand-questions.mjs"

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sample legacy exercise</title>
  </head>
  <body>
    <article itemprop="articleBody">
      <h1>Legacy Exercise</h1>
      <div class="nn_sliders accordion panel-group" id="legacy-set-1">
        <span class="anchor nn_sliders-scroll"></span>
        <div class="accordion-group panel nn_sliders-group">
          <span class="anchor nn_sliders-scroll"></span>
          <div class="accordion-heading panel-heading">
            <a class="accordion-toggle nn_sliders-toggle" data-toggle="collapse" href="#legacy-q1">
              <span class="nn_sliders-toggle-inner">1. Question one?</span>
            </a>
          </div>
          <div class="accordion-body nn_sliders-body collapse" id="legacy-q1" aria-hidden="true">
            <div class="accordion-inner panel-body">
              <h2 class="nn_sliders-title">1. Question one?</h2>
              <p>
                The answer is <span class="in-text-decoration-underline__14j0pz">example</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div class="nn_sliders accordion panel-group" id="legacy-set-2">
        <span class="anchor nn_sliders-scroll"></span>
        <div class="accordion-group panel nn_sliders-group">
          <span class="anchor nn_sliders-scroll"></span>
          <div class="accordion-heading panel-heading">
            <a class="accordion-toggle nn_sliders-toggle" data-toggle="collapse" href="#legacy-q2">
              <span class="nn_sliders-toggle-inner">2. Question two?</span>
            </a>
          </div>
          <div class="accordion-body nn_sliders-body collapse" id="legacy-q2" aria-hidden="true">
            <div class="accordion-inner panel-body">
              <h2 class="nn_sliders-title">2. Question two?</h2>
              <p>
                Another answer is <span class="in-text-decoration-underline__14j0pz">sample</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
      <p>Trailing content.</p>
    </article>
  </body>
</html>`

describe("ensureInteractiveScaffold", () => {
  it("wraps legacy accordions in the canonical exercise form", async () => {
    const result = await ensureInteractiveScaffold(SAMPLE_HTML, "sample.html")
    assert.equal(result.converted, true)
    assert.equal(result.addedQuestions, 2)
    assert.ok(
      !/<form[^>]*data-exercise-form=""/.test(result.html),
      "data-exercise-form attribute should not include an empty value"
    )

    const $ = cheerio.load(result.html, { decodeEntities: false })
    const $form = $("form.exercise-form[data-exercise-form]").first()
    assert.ok($form.length, "form scaffold should exist")
    assert.equal($form.attr("data-storage-key"), "exercise-sample")
    assert.equal($form.attr("data-exercise-question-count"), "2")

    const progressText = $form.find("[data-exercise-progress]").first().text().trim()
    assert.equal(progressText, "0 of 2 questions completed.")

    const $questions = $form.find("[data-exercise-question]")
    assert.equal($questions.length, 2)
    $questions.each((idx, el) => {
      const expectedIndex = idx + 1
      const $quest = $(el)
      assert.equal($quest.attr("data-exercise-question"), String(expectedIndex))
      const $progress = $quest.find("[data-exercise-question-progress]").first()
      assert.ok($progress.length, "question progress markup should exist")
      assert.equal($progress.attr("data-item"), String(expectedIndex))
      assert.equal($progress.attr("data-total"), "2")
      assert.equal($progress.text().trim(), `Question ${expectedIndex} of 2`)
      const inputCount = $quest.find(".exercise-response-input").length
      assert.ok(inputCount >= 1, "response inputs should be present")
    })

    const trailing = $("article p").last().text().trim()
    assert.equal(trailing, "Trailing content.")
  })

  it("repairs empty legacy response rows by injecting fallback inputs", async () => {
    const LEGACY_WITH_EMPTY_ROW = `<!DOCTYPE html>
<html lang="en">
  <body>
    <article>
      <div class="nn_sliders accordion panel-group">
        <div class="accordion-group panel nn_sliders-group">
          <div class="accordion-heading panel-heading">
            <a class="accordion-toggle nn_sliders-toggle" data-toggle="collapse" href="#legacy-q1">
              <span class="nn_sliders-toggle-inner">1. Question one?</span>
            </a>
          </div>
          <div class="accordion-body nn_sliders-body collapse" id="legacy-q1" aria-hidden="true">
            <div class="accordion-inner panel-body">
              <p>Placeholder text.</p>
            </div>
          </div>
          <div class="exercise-response-row" data-item="1"></div>
        </div>
      </div>
    </article>
  </body>
</html>`

    const result = await ensureInteractiveScaffold(LEGACY_WITH_EMPTY_ROW, "empty.html")
    assert.equal(result.converted, true)

    const $ = cheerio.load(result.html, { decodeEntities: false })
    const $row = $('.quest-bg[data-exercise-question="1"] .exercise-response-row').first()
    assert.ok($row.length, "response row should be present")
    const inputs = $row.find(".exercise-response-input")
    assert.ok(inputs.length >= 1, "fallback inputs should be injected when missing")
  })
})

describe("processHtml", () => {
  it("rebuilds response rows with fallback labels when templates are missing", () => {
    const MINIMAL_INTERACTIVE_HTML = `<!DOCTYPE html>
<html lang="en">
  <body>
    <form data-exercise-form data-exercise-question-count="1">
      <p data-exercise-progress>0 of 1 questions completed.</p>
      <div class="quest-bg" data-exercise-question="1">
        <p class="exercise-question__progress" data-exercise-question-progress="" data-item="1" data-total="1">
          Question 1 of 1
        </p>
        <div class="exercise-response-row" data-item="1"></div>
      </div>
      <div class="exercise-submit-row"></div>
    </form>
  </body>
</html>`

    const result = processHtml(MINIMAL_INTERACTIVE_HTML, {
      goal: 1,
      allowedFields: ["response", "custom"],
    })

    const $ = cheerio.load(result.output, { decodeEntities: false })
    assert.ok(
      !/<form[^>]*data-exercise-form=""/.test(result.output),
      "data-exercise-form attribute should not include an empty value"
    )
    const $inputs = $('.quest-bg[data-exercise-question="1"] .exercise-response-input')
    assert.equal($inputs.length, 2, "fallback inputs should be injected")
    assert.deepEqual($inputs.map((_, el) => $(el).attr("data-field")).get(), ["response", "custom"])
    assert.deepEqual(result.fallbackFields, ["custom"])
    assert.deepEqual(result.missingFields, [])
  })
})
