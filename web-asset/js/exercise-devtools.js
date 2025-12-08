/* Developer utilities to auto-fill exercise answers for manual QA */
(function () {
  "use strict"

  if (typeof window === "undefined") return

  var FLAG_KEY = "exercise-dev-fill:enabled"
  var EMAIL_KEY = "exercise-dev-fill:email"
  var STUDENT_KEY = "exercise-dev-fill:student"
  var DEFAULT_EMAIL = "qa@example.com"
  var DEFAULT_STUDENT = "qa001"

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn)
    else fn()
  }

  function toArray(list) {
    if (!list) return []
    return Array.prototype.slice.call(list)
  }

  function normalizeAnswer(value) {
    if (!value) return ""
    var text = String(value).toLowerCase()
    text = text.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    text = text.replace(/[^a-z0-9\s'-]/g, " ")
    text = text.replace(/-/g, " ")
    text = text.replace(/[\s\u00a0]+/g, " ")
    return text.trim()
  }

  function normalizeHashAlgorithm(name) {
    if (!name) return ""
    var text = String(name).trim().toLowerCase()
    if (!text) return ""
    if (text === "fnv1a" || text === "fnv1a64" || text === "fnv1a-64") return "fnv1a-64"
    if (text === "fnv1a32" || text === "fnv1a-32") return "fnv1a-32"
    if (text === "fnv1a128" || text === "fnv1a-128") return "fnv1a-128"
    return ""
  }

  function hashFnv1a32(value) {
    var hash = 0x811c9dc5
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
      hash >>>= 0
    }
    var hex = hash.toString(16)
    while (hex.length < 8) hex = "0" + hex
    return hex
  }

  function hashFnv1a64(value) {
    var hash = 0xcbf29ce484222325n
    var prime = 0x100000001b3n
    for (var i = 0; i < value.length; i++) {
      hash ^= BigInt(value.charCodeAt(i))
      hash = (hash * prime) & 0xffffffffffffffffn
    }
    var hex = hash.toString(16)
    while (hex.length < 16) hex = "0" + hex
    return hex
  }

  function hashFnv1a128(value) {
    var hash = 0x6c62272e07bb014262b821756295c58dn
    var prime = 0x1000000000000000000013bn
    var mask = 0xffffffffffffffffffffffffffffffffn
    for (var i = 0; i < value.length; i++) {
      hash ^= BigInt(value.charCodeAt(i))
      hash = (hash * prime) & mask
    }
    var hex = hash.toString(16)
    while (hex.length < 32) hex = "0" + hex
    return hex
  }

  function hashAnswerValue(value, algorithm) {
    var algo = normalizeHashAlgorithm(algorithm)
    if (!algo) algo = "fnv1a-64"
    if (algo === "fnv1a-32") return hashFnv1a32(value)
    if (algo === "fnv1a-128") return hashFnv1a128(value)
    return hashFnv1a64(value)
  }

  function parseHashedToken(token) {
    if (typeof token !== "string") return null
    var trimmed = token.trim()
    if (!trimmed) return null
    var index = trimmed.indexOf(":")
    if (index <= 0) return null
    var prefix = trimmed.slice(0, index)
    var algorithm = normalizeHashAlgorithm(prefix)
    if (!algorithm) return null
    var remainder = trimmed.slice(index + 1).trim()
    if (!remainder) return null
    return { algorithm: algorithm, hash: remainder }
  }

  function coerceBoolean(value, defaultValue) {
    if (typeof value === "boolean") return value
    if (typeof value === "string") {
      var lower = value.trim().toLowerCase()
      if (lower === "true") return true
      if (lower === "false") return false
    }
    return defaultValue
  }

  function prepareKeyValue(raw, options) {
    if (raw == null) return ""
    var text = String(raw)
    if (options.normalize !== false) return normalizeAnswer(text)
    text = text.trim()
    if (!options.caseSensitive) text = text.toLowerCase()
    return text
  }

  function parseAnswerToken(token, options, defaultHash) {
    if (token == null) return null
    if (typeof token === "string") {
      var hashed = parseHashedToken(token)
      if (hashed) {
        return {
          type: "hash",
          hash: hashed.hash,
          algorithm: hashed.algorithm,
        }
      }
      var prepared = prepareKeyValue(token, options)
      if (!prepared) return null
      return {
        type: "plain",
        value: prepared,
        output: String(token).trim(),
        algorithm: defaultHash || null,
      }
    }
    if (typeof token === "object" && !Array.isArray(token)) {
      if (token.hash != null) {
        var alg = normalizeHashAlgorithm(
          token.hashAlgorithm || token.algorithm || token.hashType || defaultHash
        )
        if (!alg) alg = "fnv1a-64"
        return {
          type: "hash",
          hash: String(token.hash),
          algorithm: alg,
        }
      }
      var rawValue = token.value != null ? token.value : token.answer
      if (rawValue != null) {
        var preparedValue = prepareKeyValue(rawValue, options)
        if (!preparedValue) return null
        var algorithm = normalizeHashAlgorithm(
          token.hashAlgorithm || token.algorithm || token.hashType || defaultHash
        )
        return {
          type: "plain",
          value: preparedValue,
          output: String(rawValue),
          algorithm: algorithm || defaultHash || null,
        }
      }
    }
    var fallback = prepareKeyValue(token, options)
    if (!fallback) return null
    return {
      type: "plain",
      value: fallback,
      output: String(token).trim(),
      algorithm: defaultHash || null,
    }
  }

  function uniqueLengths(values) {
    var seen = {}
    var list = []
    for (var i = 0; i < values.length; i++) {
      var value = values[i]
      if (seen[value]) continue
      seen[value] = true
      list.push(value)
    }
    return list
  }

  function buildQuestionConfig(entry, sharedOptions) {
    if (!entry || typeof entry !== "object") return null
    var answersAccepted = entry.answersAccepted
    if (answersAccepted == null) answersAccepted = []
    var manualReview = coerceBoolean(entry.manualCheckOk, false)
    var ordered = coerceBoolean(entry.orderedAnswer, false)
    var normalize = entry.normalizeAnswer
    if (typeof normalize === "string") normalize = coerceBoolean(normalize, false)
    else if (normalize == null) normalize = false
    else normalize = !!normalize
    var caseSensitive = coerceBoolean(entry.caseSensitive, true)
    if (caseSensitive && normalize) normalize = false
    var requireCorrect = entry.requireCorrectBeforeReveal
    if (requireCorrect != null) requireCorrect = coerceBoolean(requireCorrect, true)
    var hashAlgorithm =
      normalizeHashAlgorithm(
        entry.hashAlgorithm || entry.hashEncoding || entry.hashAlgorithmName || entry.hash
      ) ||
      normalizeHashAlgorithm(sharedOptions && sharedOptions.defaultHashAlgorithm) ||
      ""

    var options = {
      normalize: normalize,
      caseSensitive: caseSensitive,
    }

    var textAnswers = []
    if (entry.answersText != null) {
      var provided = Array.isArray(entry.answersText) ? entry.answersText : [entry.answersText]
      for (var t = 0; t < provided.length; t++) {
        var rawText = provided[t]
        if (rawText == null) continue
        var preparedText = String(rawText).trim()
        if (!preparedText) continue
        textAnswers.push(preparedText)
      }
    }

    var combos = []
    if (!Array.isArray(answersAccepted)) answersAccepted = [answersAccepted]
    for (var i = 0; i < answersAccepted.length; i++) {
      var combo = answersAccepted[i]
      if (combo == null) continue
      var list = Array.isArray(combo) ? combo : [combo]
      var prepared = []
      for (var j = 0; j < list.length; j++) {
        var token = parseAnswerToken(list[j], options, hashAlgorithm)
        if (!token) continue
        if (token.type === "hash" && token.algorithm && !hashAlgorithm) {
          hashAlgorithm = token.algorithm
        }
        prepared.push(token)
      }
      if (prepared.length) combos.push(prepared)
    }

    var lengths = []
    for (var c = 0; c < combos.length; c++) lengths.push(combos[c].length)
    lengths = uniqueLengths(lengths)
    var minLength = lengths.length ? lengths[0] : 1
    for (var l = 1; l < lengths.length; l++) if (lengths[l] < minLength) minLength = lengths[l]
    var maxLength = lengths.length ? lengths[0] : 0
    for (var m = 1; m < lengths.length; m++) if (lengths[m] > maxLength) maxLength = lengths[m]

    return {
      id: entry.id != null ? String(entry.id) : null,
      combos: combos,
      lengths: lengths,
      minLength: minLength || 1,
      maxLength: maxLength || 0,
      manualReview: manualReview,
      ordered: ordered,
      normalize: normalize,
      caseSensitive: caseSensitive,
      requireCorrectBeforeReveal: requireCorrect,
      hashAlgorithm: hashAlgorithm || "",
      textAnswers: textAnswers,
    }
  }

  function padQuestionNumber(value) {
    var digits = String(value == null ? "" : value).replace(/[^0-9]/g, "")
    if (!digits) return ""
    while (digits.length < 2) digits = "0" + digits
    return digits
  }

  function setQuestionConfig(registry, key, config) {
    if (key == null) return
    var str = String(key)
    registry[str] = config
    var digits = padQuestionNumber(str)
    if (digits) {
      registry[String(parseInt(digits, 10))] = config
      registry["question" + digits] = config
      registry["q" + digits] = config
    }
  }

  function registerAnswerEntry(answerKey, entry, fallbackId) {
    if (!entry || typeof entry !== "object") return
    var questionConfig = buildQuestionConfig(entry, answerKey.options)
    if (!questionConfig) return
    var id = questionConfig.id || fallbackId
    if (id == null) return
    setQuestionConfig(answerKey.questions, id, questionConfig)
    if (fallbackId != null) setQuestionConfig(answerKey.questions, fallbackId, questionConfig)
  }

  function parseAnswerKey(script) {
    var empty = { questions: {}, options: {} }
    if (!script) return empty
    var raw = script.textContent || script.innerText || ""
    if (!raw) return empty
    try {
      var parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") return empty
      var answerKey = { questions: {}, options: {} }
      if (parsed.options && typeof parsed.options === "object") answerKey.options = parsed.options
      var defaultHash =
        parsed.defaultHashAlgorithm ||
        (answerKey.options ? answerKey.options.defaultHashAlgorithm : null) ||
        (answerKey.options ? answerKey.options.hashAlgorithm : null)
      defaultHash = normalizeHashAlgorithm(defaultHash)
      if (!answerKey.options) answerKey.options = {}
      if (defaultHash) answerKey.options.defaultHashAlgorithm = defaultHash
      var payload = parsed.answerArrays || parsed.answerKey || parsed.answers || null
      if (payload && typeof payload === "object") {
        var source = payload.answerArray || payload.questions || payload.items || payload
        if (Array.isArray(source)) {
          for (var i = 0; i < source.length; i++) registerAnswerEntry(answerKey, source[i], i + 1)
        } else {
          for (var key in source) {
            if (!Object.prototype.hasOwnProperty.call(source, key)) continue
            registerAnswerEntry(answerKey, source[key], key)
          }
        }
      }
      return answerKey
    } catch (err) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("exercise-devtools: unable to parse answer key", err)
      }
      return empty
    }
  }

  function gatherHints(panel) {
    if (!panel) return []
    var hints = []
    var seen = {}

    function splitHintText(raw) {
      if (!raw) return []
      var text = String(raw)
      var parts = text.split(/\r?\n+/)
      var results = []
      for (var i = 0; i < parts.length; i++) {
        var chunk = parts[i]
        if (!chunk) continue
        var numbered = chunk.split(/\s+(?=\d+[.)-]\s+)/).filter(Boolean)
        if (numbered.length) {
          for (var n = 0; n < numbered.length; n++) results.push(numbered[n])
        } else {
          results.push(chunk)
        }
      }
      return results
    }

    function addHint(raw) {
      var trimmed = (raw || "").trim()
      if (!trimmed) return
      var withoutNumber = trimmed.replace(/^\s*\d+[.)-]?\s*/, "")
      var normalized = normalizeAnswer(withoutNumber)
      var rawText = withoutNumber.trim()
      var dedupeKey = rawText || normalized
      if (!dedupeKey) return
      if (seen[dedupeKey]) return
      seen[dedupeKey] = true
      hints.push({
        text: withoutNumber,
        normalized: normalized,
        raw: rawText,
      })
    }

    var spans = panel.querySelectorAll(".in-text-decoration-underline__14j0pz")
    for (var i = 0; i < spans.length; i++) addHint(spans[i].textContent || spans[i].innerText || "")

    var paragraphs = panel.querySelectorAll(".accordion-inner p")
    for (var p = 0; p < paragraphs.length; p++) {
      var raw = paragraphs[p].textContent || paragraphs[p].innerText || ""
      var chunks = splitHintText(raw)
      if (!chunks.length) addHint(raw)
      for (var c = 0; c < chunks.length; c++) addHint(chunks[c])
    }

    return hints
  }

  function findQuestionConfig(answerKey, questionId) {
    if (!answerKey || !answerKey.questions) return null
    var config = answerKey.questions[questionId]
    if (!config) {
      var padded = padQuestionNumber(questionId)
      if (padded) {
        config =
          answerKey.questions["question" + padded] ||
          answerKey.questions["q" + padded] ||
          answerKey.questions[String(parseInt(padded, 10))]
      }
    }
    return config || null
  }

  function cloneMap(map) {
    var clone = {}
    for (var key in map) {
      if (!Object.prototype.hasOwnProperty.call(map, key)) continue
      clone[key] = map[key].slice()
    }
    return clone
  }

  function createCandidateMap(question, algorithm) {
    if (!algorithm) return {}
    var key = algorithm
    if (!question.candidateMaps) question.candidateMaps = {}
    if (question.candidateMaps[key]) return question.candidateMaps[key]
    var map = {}
    function add(hash, display) {
      if (!hash) return
      if (!map[hash]) map[hash] = []
      map[hash].push(display)
    }
    for (var i = 0; i < question.hints.length; i++) {
      var hint = question.hints[i]
      if (!hint) continue
      var rawValue = hint.raw || ""
      var normalizedValue = hint.normalized || ""
      var display = hint.text || rawValue || normalizedValue
      if (rawValue) add(hashAnswerValue(rawValue, algorithm), display)
      if (normalizedValue && normalizedValue !== rawValue) {
        add(hashAnswerValue(normalizedValue, algorithm), display)
      }
    }
    question.candidateMaps[key] = map
    return map
  }

  function resolveCombination(question, config, combo, defaultAlgorithm) {
    var values = []
    var maps = {}
    for (var i = 0; i < combo.length; i++) {
      var token = combo[i]
      if (token.type === "plain") {
        values.push(token.output || token.value || "")
        continue
      }
      var algorithm = token.algorithm || config.hashAlgorithm || defaultAlgorithm
      if (!algorithm) return null
      if (!maps[algorithm]) maps[algorithm] = cloneMap(createCandidateMap(question, algorithm))
      var map = maps[algorithm]
      var list = map[token.hash]
      if (!list || !list.length) return null
      values.push(list.shift())
    }
    return values
  }

  function dispatchEvent(node, type) {
    if (!node) return
    try {
      var event = new Event(type, { bubbles: true, cancelable: true })
      node.dispatchEvent(event)
    } catch (err) {
      void err
      var legacy = document.createEvent("Event")
      legacy.initEvent(type, true, true)
      node.dispatchEvent(legacy)
    }
  }

  function tryClick(node) {
    if (!node) return
    try {
      node.click()
    } catch (err) {
      void err
      var event = new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
      node.dispatchEvent(event)
    }
  }

  function readStorage(key) {
    try {
      if (!window.localStorage) return null
      return window.localStorage.getItem(key)
    } catch (err) {
      void err
      return null
    }
  }

  function writeStorage(key, value) {
    try {
      if (!window.localStorage) return
      if (value == null) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, value)
    } catch (err) {
      void err
      /* ignore storage failures */
    }
  }

  function readAutoPreference() {
    if (typeof document === "undefined") return null
    var hostNode = document.querySelector("[data-exercise-devtools]")
    if (!hostNode) return null
    var raw = hostNode.getAttribute("data-exercise-devtools")
    if (raw == null) return true
    var normalized = String(raw).trim().toLowerCase()
    if (!normalized) return true
    if (
      normalized === "0" ||
      normalized === "false" ||
      normalized === "off" ||
      normalized === "disable" ||
      normalized === "disabled" ||
      normalized === "manual"
    ) {
      return false
    }
    if (
      normalized === "1" ||
      normalized === "true" ||
      normalized === "on" ||
      normalized === "enable" ||
      normalized === "enabled" ||
      normalized === "auto"
    ) {
      return true
    }
    return true
  }

  function shouldEnableByDefault() {
    if (typeof window === "undefined") return false
    var search = window.location ? window.location.search || "" : ""
    if (/([?&])dev-fill=1(?![0-9])/i.test(search)) return true
    if (/([?&])dev-fill=0(?![0-9])/i.test(search)) return false
    var autoPref = readAutoPreference()
    if (autoPref !== null) return autoPref
    return readStorage(FLAG_KEY) === "1"
  }

  function hasDisableQuery() {
    if (typeof window === "undefined") return false
    var search = window.location ? window.location.search || "" : ""
    return /([?&])dev-fill=0(?![0-9])/i.test(search)
  }

  function ensureCredentials(state, overrides) {
    var emailInput = state.emailInput
    var studentInput = state.studentIdInput
    var storedEmail = readStorage(EMAIL_KEY) || DEFAULT_EMAIL
    var storedStudent = readStorage(STUDENT_KEY) || DEFAULT_STUDENT
    if (overrides && overrides.email) storedEmail = overrides.email
    if (overrides && overrides.studentId) storedStudent = overrides.studentId
    if (emailInput && !emailInput.value) {
      emailInput.value = storedEmail
      dispatchEvent(emailInput, "input")
      dispatchEvent(emailInput, "change")
    }
    if (studentInput && !studentInput.value) {
      studentInput.value = storedStudent
      dispatchEvent(studentInput, "input")
      dispatchEvent(studentInput, "change")
    }
    return {
      email: emailInput ? emailInput.value : "",
      studentId: studentInput ? studentInput.value : "",
    }
  }

  function storeCredentials(data) {
    if (!data) return
    if (data.email) writeStorage(EMAIL_KEY, data.email)
    if (data.studentId) writeStorage(STUDENT_KEY, data.studentId)
  }

  function fillQuestion(state, question, options) {
    if (!question || !question.config || !question.config.combos.length) {
      return Promise.resolve({ success: false, reason: "missing-config" })
    }
    var combos = question.config.combos || []
    if (combos.length > 1) combos = [combos[0]]
    if (question.isSingleField && combos.length) {
      var firstCombo = combos[0]
      var firstToken = Array.isArray(firstCombo) && firstCombo.length ? firstCombo[0] : firstCombo
      combos = firstToken ? [[firstToken]] : []
    }
    var defaultAlgorithm =
      question.config.hashAlgorithm ||
      (state.answerKey.options ? state.answerKey.options.defaultHashAlgorithm : "") ||
      ""
    var resolved = null
    for (var i = 0; i < combos.length; i++) {
      var attempt = resolveCombination(question, question.config, combos[i], defaultAlgorithm)
      if (attempt) {
        resolved = { values: attempt, combo: combos[i] }
        break
      }
    }
    if (!resolved) {
      return Promise.resolve({ success: false, reason: "unresolved" })
    }

    var inputs = question.inputs
    var values = resolved.values
    for (var idx = 0; idx < inputs.length; idx++) {
      var value = idx < values.length ? values[idx] : ""
      inputs[idx].value = value
      dispatchEvent(inputs[idx], "input")
      dispatchEvent(inputs[idx], "change")
    }

    if (options && options.unlock === false) {
      return Promise.resolve({ success: true, values: values })
    }

    return new Promise(function (resolve) {
      window.setTimeout(
        function () {
          if (question.toggle) tryClick(question.toggle)
          window.setTimeout(function () {
            resolve({ success: true, values: values })
          }, 80)
        },
        options && options.delayBeforeUnlock != null ? options.delayBeforeUnlock : 30
      )
    })
  }

  function fillAll(state, options) {
    options = options || {}
    ensureCredentials(state, options.credentials)
    var results = []
    var sequence = Promise.resolve()
    for (var i = 0; i < state.questions.length; i++) {
      (function (question) {
        sequence = sequence.then(function () {
          return fillQuestion(state, question, options).then(function (result) {
            results.push({ id: question.id, result: result })
          })
        })
      })(state.questions[i])
    }
    return sequence.then(function () {
      if (options.focusSubmit) {
        var submit = state.submitButton
        if (submit) submit.focus()
      }
      return results
    })
  }

  function findQuestionById(state, id) {
    for (var i = 0; i < state.questions.length; i++) {
      if (String(state.questions[i].id) === String(id)) return state.questions[i]
    }
    return null
  }

  function removeButton(state) {
    if (state.fillButton && state.fillButton.parentNode) {
      state.fillButton.parentNode.removeChild(state.fillButton)
    }
    state.fillButton = null
  }

  function ensureButton(state) {
    if (state.fillButton) return state.fillButton
    var button = document.createElement("button")
    button.type = "button"
    button.className = "exercise-devtools__fill-button"
    button.textContent = "Auto-fill answers"
    button.addEventListener("click", function () {
      button.disabled = true
      if (button.classList) button.classList.add("exercise-devtools__fill-button--busy")
      fillAll(state, { focusSubmit: true }).finally(function () {
        button.disabled = false
        if (button.classList) button.classList.remove("exercise-devtools__fill-button--busy")
      })
    })
    document.body.appendChild(button)
    state.fillButton = button
    return button
  }

  function buildState(form) {
    var answerKey = parseAnswerKey(document.querySelector("[data-exercise-answer-key]"))
    var questionNodes = toArray(form.querySelectorAll("[data-exercise-question]"))
    var questions = []
    for (var i = 0; i < questionNodes.length; i++) {
      var node = questionNodes[i]
      var toggle = node.querySelector(".nn_sliders-toggle")
      var row = node.querySelector(".exercise-response-row")
      var inputs = toArray(node.querySelectorAll(".exercise-response-input"))
      var isTextarea = false
      if (row && row.getAttribute("data-answer-ui")) {
        isTextarea = row.getAttribute("data-answer-ui").toLowerCase() === "textarea"
      }
      if (!isTextarea && inputs.length && inputs[0].tagName === "TEXTAREA") isTextarea = true
      var isSingleField = inputs.length === 1
      var questionId = String(node.getAttribute("data-exercise-question") || i + 1)
      var panel = null
      if (toggle) {
        var controlId = toggle.getAttribute("aria-controls") || toggle.getAttribute("data-id") || ""
        if (controlId && controlId.indexOf("#") !== -1) controlId = controlId.split("#").pop()
        if (!controlId) controlId = toggle.getAttribute("data-id") || ""
        if (controlId) panel = document.getElementById(controlId)
      }
      var hints = gatherHints(panel)
      var config = findQuestionConfig(answerKey, questionId, hints)
      if (config && config.textAnswers && config.textAnswers.length) {
        for (var t = 0; t < config.textAnswers.length; t++) {
          var textAnswer = config.textAnswers[t]
          if (!textAnswer) continue
          var rawText = String(textAnswer).trim()
          if (!rawText) continue
          hints.push({
            text: rawText,
            normalized: normalizeAnswer(rawText),
            raw: rawText,
          })
        }
      }
      questions.push({
        id: questionId,
        node: node,
        toggle: toggle,
        row: row,
        inputs: inputs,
        panel: panel,
        hints: hints,
        config: config,
        isTextarea: isTextarea,
        isSingleField: isSingleField,
        candidateMaps: {},
      })
    }
    return {
      form: form,
      answerKey: answerKey,
      questions: questions,
      emailInput: form.querySelector("[data-exercise-email]"),
      studentIdInput: form.querySelector("[data-exercise-student-id]"),
      submitButton: form.querySelector("[data-exercise-submit]"),
      fillButton: null,
    }
  }

  ready(function () {
    var form = document.querySelector("[data-exercise-form]")
    if (!form) return
    var state = buildState(form)
    if (!state.questions.length) return

    var api = {
      enable: function (options) {
        if (hasDisableQuery()) return
        writeStorage(FLAG_KEY, "1")
        ensureButton(state)
        if (!options || !options.silent) {
          if (console && console.info) console.info("exerciseDevTools enabled")
        }
      },
      disable: function (options) {
        writeStorage(FLAG_KEY, "0")
        removeButton(state)
        if (!options || !options.silent) {
          if (console && console.info) console.info("exerciseDevTools disabled")
        }
      },
      isEnabled: function () {
        return !!state.fillButton
      },
      fillAll: function (options) {
        return fillAll(state, options || {})
      },
      fillQuestion: function (id, options) {
        var question = findQuestionById(state, id)
        if (!question) return Promise.resolve({ success: false, reason: "unknown-question" })
        return fillQuestion(state, question, options || {})
      },
      setCredentials: function (data) {
        storeCredentials(data)
        ensureCredentials(state, data)
      },
      ensureCredentials: function () {
        return ensureCredentials(state)
      },
      version: "2024-06-01",
    }

    Object.defineProperty(window, "exerciseDevTools", {
      value: api,
      configurable: true,
    })

    if (shouldEnableByDefault() && !hasDisableQuery()) {
      api.enable({ silent: true })
    }
    if (!state.fillButton) {
      var autoPreference = readAutoPreference()
      if (autoPreference && !hasDisableQuery()) {
        var fallbackEnable = function () {
          if (!state.fillButton && !hasDisableQuery()) {
            api.enable({ silent: true })
          }
        }
        if (typeof window !== "undefined" && window.addEventListener) {
          var onLoad = function () {
            window.removeEventListener("load", onLoad)
            fallbackEnable()
          }
          window.addEventListener("load", onLoad)
        }
        if (typeof window !== "undefined" && window.setTimeout) {
          window.setTimeout(fallbackEnable, 800)
        }
      }
    }
  })
})()
