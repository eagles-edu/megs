/* Gate exercise accordions behind correct answers and collect submissions */
(function () {
  "use strict"

  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  function coerceBoolean(value, defaultValue) {
    if (typeof value === "boolean") return value
    if (typeof value === "string") {
      var lower = value.trim().toLowerCase()
      if (lower === "true") return true
      if (lower === "false") return false
    }
    return defaultValue
  }

  function fromCodePointSafe(code) {
    if (typeof code !== "number" || !isFinite(code)) return ""
    if (typeof String.fromCodePoint === "function") {
      try {
        return String.fromCodePoint(code)
      } catch (err) {
        void err
        /* fallback below */
      }
    }
    if (code <= 0xffff) return String.fromCharCode(code)
    var adjusted = code - 0x10000
    var high = (adjusted >> 10) + 0xd800
    var low = (adjusted % 0x400) + 0xdc00
    return String.fromCharCode(high, low)
  }

  function decodeCodePoints(value) {
    if (!value && value !== 0) return ""
    var list = []
    if (Array.isArray(value)) list = value.slice()
    else if (typeof value === "string") list = value.split(/[^0-9]+/g)
    else list = [value]
    var result = ""
    for (var i = 0; i < list.length; i++) {
      var token = list[i]
      if (token === "" || token === null || token === undefined) continue
      var num = typeof token === "number" ? token : parseInt(String(token), 10)
      if (!isFinite(num)) continue
      result += fromCodePointSafe(num)
    }
    return result.trim()
  }

  function decodeUtf8Hex(hex) {
    if (!hex) return ""
    var normalized = String(hex)
      .trim()
      .replace(/[^0-9a-fA-F]/g, "")
      .toLowerCase()
    if (!normalized || normalized.length % 2 !== 0) return ""
    var bytes = []
    for (var i = 0; i < normalized.length; i += 2) {
      var slice = normalized.slice(i, i + 2)
      var value = parseInt(slice, 16)
      if (!isFinite(value)) return ""
      bytes.push(value)
    }
    if (typeof TextDecoder !== "undefined" && typeof Uint8Array !== "undefined") {
      try {
        return new TextDecoder("utf-8").decode(new Uint8Array(bytes)).trim()
      } catch (err) {
        void err
        /* fall through */
      }
    }
    var encoded = ""
    for (var idx = 0; idx < bytes.length; idx++) {
      var h = bytes[idx].toString(16)
      if (h.length < 2) h = "0" + h
      encoded += "%" + h
    }
    try {
      return decodeURIComponent(encoded).trim()
    } catch (err) {
      void err
      var fallback = ""
      for (var j = 0; j < bytes.length; j++) fallback += String.fromCharCode(bytes[j])
      return fallback.trim()
    }
  }

  function decodeRecipientToken(token) {
    if (token == null) return ""
    if (typeof token === "string") return token.trim()
    if (typeof token === "number") return fromCodePointSafe(token)
    if (Array.isArray(token)) return decodeCodePoints(token)
    if (typeof token === "object") {
      if (typeof token.email === "string") return token.email.trim()
      if (typeof token.value === "string") return token.value.trim()
      if (typeof token.utf8 === "string") return decodeUtf8Hex(token.utf8)
      if (Array.isArray(token.utf8)) return decodeCodePoints(token.utf8)
      var codePoints =
        token.codePoints ||
        token.codepoints ||
        token.code_point ||
        token.codepoint ||
        token.cp ||
        token.points ||
        token.codes
      if (codePoints != null) {
        var decoded = decodeCodePoints(codePoints)
        if (decoded) return decoded
      }
      if (typeof token.bytes === "string") return decodeUtf8Hex(token.bytes)
      if (Array.isArray(token.bytes)) return decodeCodePoints(token.bytes)
    }
    return ""
  }

  function normalizeRecipients(list) {
    if (!Array.isArray(list)) return []
    var decoded = []
    for (var i = 0; i < list.length; i++) {
      var entry = decodeRecipientToken(list[i])
      if (!entry) continue
      var trimmed = entry.trim()
      if (!trimmed) continue
      decoded.push(trimmed)
    }
    return decoded
  }

  function padQuestionNumber(value) {
    var digits = String(value == null ? "" : value).replace(/[^0-9]/g, "")
    if (!digits) return ""
    while (digits.length < 2) digits = "0" + digits
    return digits
  }

  function prepareKeyValue(raw, options) {
    if (raw == null) return ""
    var text = String(raw)
    if (options.normalize !== false) {
      return normalizeAnswer(text)
    }
    text = text.trim()
    if (!options.caseSensitive) text = text.toLowerCase()
    return text
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
      if (parsed.options && typeof parsed.options === "object") {
        answerKey.options = parsed.options
      }
      var defaultHash =
        parsed.defaultHashAlgorithm ||
        (answerKey.options ? answerKey.options.defaultHashAlgorithm : null) ||
        (answerKey.options ? answerKey.options.hashAlgorithm : null)
      defaultHash = normalizeHashAlgorithm(defaultHash)
      if (!answerKey.options) answerKey.options = {}
      if (defaultHash) answerKey.options.defaultHashAlgorithm = defaultHash
      if (parsed.requireCorrectBeforeReveal != null) {
        answerKey.options.requireCorrectBeforeReveal = coerceBoolean(
          parsed.requireCorrectBeforeReveal,
          true
        )
      }
      var payload = parsed.answerArrays || parsed.answerKey || parsed.answers || null
      if (payload && typeof payload === "object") {
        var source = payload.answerArray || payload.questions || payload.items || payload
        if (Array.isArray(source)) {
          for (var i = 0; i < source.length; i++) {
            registerAnswerEntry(answerKey, source[i], i + 1)
          }
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
        console.warn("exercise-gate: unable to parse answer key", err)
      }
      return empty
    }
  }

  function registerAnswerEntry(answerKey, entry, fallbackId) {
    if (!entry || typeof entry !== "object") return
    var questionConfig = buildQuestionConfig(entry, answerKey.options)
    if (!questionConfig) return
    var id = questionConfig.id || fallbackId
    if (id == null) return
    var idStr = String(id)
    setQuestionConfig(answerKey.questions, idStr, questionConfig)
    if (fallbackId != null) setQuestionConfig(answerKey.questions, fallbackId, questionConfig)
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
    var answersAccepted = entry.answersAccepted
    if (answersAccepted == null) answersAccepted = []
    var manualReview = coerceBoolean(entry.manualCheckOk, false)
    var ordered = coerceBoolean(entry.orderedAnswer, false)
    var normalize = entry.normalizeAnswer
    if (typeof normalize === "string") normalize = coerceBoolean(normalize, true)
    else if (normalize == null) normalize = true
    else normalize = !!normalize
    var caseSensitive = coerceBoolean(entry.caseSensitive, false)
    if (caseSensitive && normalize) normalize = false
    var requireCorrect = entry.requireCorrectBeforeReveal
    if (requireCorrect != null) requireCorrect = coerceBoolean(requireCorrect, true)
    var hashAlgorithm =
      normalizeHashAlgorithm(
        entry.hashAlgorithm || entry.hashEncoding || entry.hashAlgorithmName || entry.hash
      ) || normalizeHashAlgorithm(sharedOptions && sharedOptions.defaultHashAlgorithm)

    var options = {
      manualReview: manualReview,
      ordered: ordered,
      normalize: normalize,
      caseSensitive: caseSensitive,
      requireCorrectBeforeReveal: requireCorrect,
    }

    var acceptedAnswers = []
    if (!Array.isArray(answersAccepted)) answersAccepted = [answersAccepted]
    for (var i = 0; i < answersAccepted.length; i++) {
      var combo = answersAccepted[i]
      if (combo == null) continue
      var list = Array.isArray(combo) ? combo : [combo]
      var prepared = []
      for (var j = 0; j < list.length; j++) {
        var token = list[j]
        var parsedToken = parseAnswerToken(token, options, hashAlgorithm)
        if (!parsedToken) continue
        if (parsedToken.algorithm && !hashAlgorithm) {
          hashAlgorithm = parsedToken.algorithm
        }
        if (parsedToken.kind === "hash") {
          prepared.push(parsedToken.value)
        } else if (parsedToken.kind === "plain") {
          if (parsedToken.algorithm) {
            var hashedValue = hashAnswerValue(parsedToken.value, parsedToken.algorithm)
            prepared.push(hashedValue)
            if (!hashAlgorithm) hashAlgorithm = parsedToken.algorithm
          } else if (hashAlgorithm) {
            prepared.push(hashAnswerValue(parsedToken.value, hashAlgorithm))
          } else {
            prepared.push(parsedToken.value)
          }
        }
      }
      if (prepared.length) acceptedAnswers.push(prepared)
    }

    var lengths = []
    for (var a = 0; a < acceptedAnswers.length; a++) lengths.push(acceptedAnswers[a].length)
    lengths = uniqueLengths(lengths)
    var minLength = lengths.length ? lengths[0] : 1
    for (var l = 1; l < lengths.length; l++) if (lengths[l] < minLength) minLength = lengths[l]
    var maxLength = lengths.length ? lengths[0] : 0
    for (var m = 1; m < lengths.length; m++) if (lengths[m] > maxLength) maxLength = lengths[m]

    return {
      id: entry.id != null ? String(entry.id) : null,
      acceptedAnswers: acceptedAnswers,
      lengths: lengths,
      minLength: minLength || 1,
      maxLength: maxLength || 0,
      manualReview: options.manualReview,
      ordered: options.ordered,
      normalize: options.normalize,
      caseSensitive: options.caseSensitive,
      requireCorrectBeforeReveal: options.requireCorrectBeforeReveal,
      hashAlgorithm: hashAlgorithm,
    }
  }

  function parseAnswerToken(token, options, defaultHash) {
    if (token == null) return null
    if (typeof token === "string") {
      var trimmedToken = token.trim()
      if (trimmedToken) {
        var splitIndex = trimmedToken.indexOf(":")
        if (splitIndex > 0) {
          var prefix = trimmedToken.slice(0, splitIndex)
          var parsedAlgorithm = normalizeHashAlgorithm(prefix)
          var remainder = trimmedToken.slice(splitIndex + 1).trim()
          if (parsedAlgorithm && remainder) {
            return {
              kind: "hash",
              value: remainder,
              algorithm: parsedAlgorithm || normalizeHashAlgorithm(defaultHash) || "fnv1a-64",
            }
          }
        }
      }
      var prepared = prepareKeyValue(trimmedToken, options)
      if (!prepared) return null
      return { kind: "plain", value: prepared, algorithm: defaultHash }
    }
    if (typeof token === "object" && !Array.isArray(token)) {
      if (token.hash != null) {
        var alg = normalizeHashAlgorithm(
          token.hashAlgorithm || token.algorithm || token.hashType || defaultHash
        )
        if (!alg) alg = "fnv1a-64"
        return { kind: "hash", value: String(token.hash), algorithm: alg }
      }
      var rawValue = token.value != null ? token.value : token.answer
      if (rawValue != null) {
        var preparedValue = prepareKeyValue(rawValue, options)
        if (!preparedValue) return null
        var algorithm = normalizeHashAlgorithm(
          token.hashAlgorithm || token.algorithm || token.hashType || defaultHash
        )
        return { kind: "plain", value: preparedValue, algorithm: algorithm || defaultHash }
      }
    }
    var fallback = prepareKeyValue(token, options)
    if (!fallback) return null
    return { kind: "plain", value: fallback, algorithm: defaultHash }
  }

  function prepareInputValue(value, config) {
    if (config && config.normalize === false) {
      var trimmed = String(value == null ? "" : value).trim()
      if (!config.caseSensitive) trimmed = trimmed.toLowerCase()
      return trimmed
    }
    return normalizeAnswer(value)
  }

  function parseConfig(script) {
    if (!script) return {}
    var raw = script.textContent || script.innerText || ""
    if (!raw) return {}
    try {
      var parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") return {}
      if (!parsed.recipients || !Array.isArray(parsed.recipients)) parsed.recipients = []
      parsed.recipients = normalizeRecipients(parsed.recipients)
      return parsed
    } catch (err) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("exercise-gate: unable to parse config", err)
      }
      return {}
    }
  }

  function readStoredAttempt(key) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null
      var raw = window.localStorage.getItem(key)
      if (!raw) return null
      var parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") return null
      return parsed
    } catch {
      return null
    }
  }

  function readStoredList(key) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return []
      var raw = window.localStorage.getItem(key)
      if (!raw) return []
      var parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
    } catch {
      return []
    }
  }

  function writeStoredAttempt(key, data) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return
      window.localStorage.setItem(key, JSON.stringify(data))
    } catch {
      /* storage disabled */
    }
  }

  function writeStoredList(key, list) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return
      window.localStorage.setItem(key, JSON.stringify(list))
    } catch {
      /* storage disabled */
    }
  }

  function addContactHistory(list, value, limit) {
    var normalized = (value || "").trim()
    if (!normalized) return Array.isArray(list) ? list.slice() : []
    var history = Array.isArray(list) ? list.slice() : []
    for (var i = 0; i < history.length; i++) {
      if ((history[i] || "").trim() === normalized) {
        history.splice(i, 1)
        break
      }
    }
    history.unshift(normalized)
    var max = limit && limit > 0 ? limit : 5
    while (history.length > max) history.pop()
    return history
  }

  function formatTimestamp(timestamp) {
    var date = new Date(timestamp)
    if (isNaN(date.getTime())) return ""
    try {
      return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    } catch {
      try {
        return date.toLocaleString()
      } catch {
        return date.toISOString()
      }
    }
  }

  function rememberContactValue(input, value, listId) {
    if (!input) return
    var normalized = (value || "").trim()
    if (!normalized) return
    var existingList = input.list
    var list = existingList && existingList.id === listId ? existingList : null
    if (!list) {
      list = document.createElement("datalist")
      list.id = listId
      input.setAttribute("list", listId)
      if (input.parentNode) {
        input.parentNode.insertBefore(list, input.nextSibling)
      }
    }
    var options = list.querySelectorAll("option")
    for (var i = 0; i < options.length; i++) {
      if ((options[i].value || "").trim() === normalized) return
    }
    var option = document.createElement("option")
    option.value = normalized
    list.appendChild(option)
  }

  ready(function () {
    var form = document.querySelector("[data-exercise-form]")
    if (!form) return

    var emailInput = form.querySelector("[data-exercise-email]")
    var studentIdInput = form.querySelector("[data-exercise-student-id]")
    var submitRow = form.querySelector("[data-exercise-submit-row]")
    var submitButton = form.querySelector("[data-exercise-submit]")
    var progressEl = form.querySelector("[data-exercise-progress]")
    var feedbackEl = form.querySelector("[data-exercise-feedback]")
    var lastAttemptEl = form.querySelector("[data-exercise-last-attempt]")
    var storageKey = "exercise-progress:" + (form.getAttribute("data-storage-key") || "default")
    var emailListId = storageKey + ":email"
    var studentListId = storageKey + ":student"
    var emailHistoryKey = storageKey + ":email-history"
    var studentHistoryKey = storageKey + ":student-history"
    if (emailInput) emailInput.setAttribute("autocomplete", "off")
    if (studentIdInput) studentIdInput.setAttribute("autocomplete", "off")
    var config = parseConfig(document.querySelector("[data-exercise-config]"))
    if (!config.recipients) config.recipients = []
    var answerKey = parseAnswerKey(document.querySelector("[data-exercise-answer-key]"))
    var globalRequireCorrect = coerceBoolean(
      answerKey.options && answerKey.options.requireCorrectBeforeReveal,
      true
    )
    var emailHistory = readStoredList(emailHistoryKey)
    var studentHistory = readStoredList(studentHistoryKey)

    if (emailInput) {
      for (var eh = 0; eh < emailHistory.length; eh++) {
        rememberContactValue(emailInput, emailHistory[eh], emailListId)
      }
    }
    if (studentIdInput) {
      for (var sh = 0; sh < studentHistory.length; sh++) {
        rememberContactValue(studentIdInput, studentHistory[sh], studentListId)
      }
    }

    clearContactInputs()

    var questionNodes = toArray(form.querySelectorAll("[data-exercise-question]"))
    var questions = []

    for (var i = 0; i < questionNodes.length; i++) {
      var node = questionNodes[i]
      var toggle = node.querySelector(".nn_sliders-toggle")
      var row = node.querySelector(".exercise-response-row")
      var inputs = toArray(node.querySelectorAll(".exercise-response-input"))
      var answers = []
      var panel = null
      if (toggle) {
        var controlId = toggle.getAttribute("aria-controls") || toggle.getAttribute("data-id") || ""
        if (controlId) panel = document.getElementById(controlId)
      }
      if (panel) {
        var spans = panel.querySelectorAll(".in-text-decoration-underline__14j0pz")
        for (var s = 0; s < spans.length; s++) {
          var text = normalizeAnswer(spans[s].textContent || spans[s].innerText || "")
          if (text) answers.push(text)
        }
      }
      var questionId = String(node.getAttribute("data-exercise-question") || i + 1)
      var configEntry = answerKey.questions[questionId]
      if (!configEntry) {
        var padded = padQuestionNumber(questionId || i + 1)
        if (padded) {
          configEntry =
            answerKey.questions["question" + padded] ||
            answerKey.questions["q" + padded] ||
            answerKey.questions[String(parseInt(padded, 10))]
        }
      }
      if (!configEntry && answers.length) {
        configEntry = {
          id: questionId,
          acceptedAnswers: [answers.slice()],
          lengths: [answers.length],
          minLength: answers.length || 1,
          maxLength: answers.length || 0,
          manualReview: false,
          ordered: false,
          normalize: true,
          caseSensitive: false,
          requireCorrectBeforeReveal: true,
        }
      } else if (!configEntry) {
        configEntry = {
          id: questionId,
          acceptedAnswers: [],
          lengths: [],
          minLength: 1,
          maxLength: 0,
          manualReview: true,
          ordered: false,
          normalize: true,
          caseSensitive: false,
          requireCorrectBeforeReveal: true,
        }
      }
      var requireCorrect = globalRequireCorrect
      if (configEntry && configEntry.requireCorrectBeforeReveal != null) {
        requireCorrect = coerceBoolean(configEntry.requireCorrectBeforeReveal, requireCorrect)
      }
      questions.push({
        id: questionId,
        node: node,
        toggle: toggle,
        row: row,
        panel: panel,
        inputs: inputs,
        answers: answers,
        answerConfig: configEntry || null,
        requireCorrect: requireCorrect,
        complete: false,
        pendingReview: false,
        status: "incomplete",
        flashTimer: null,
      })
    }

    var totalQuestions = questions.length

    function clearFeedback() {
      if (!feedbackEl) return
      feedbackEl.textContent = ""
      feedbackEl.classList.remove(
        "exercise-form__feedback--error",
        "exercise-form__feedback--success"
      )
    }

    function setFeedback(message, type) {
      if (!feedbackEl) return
      feedbackEl.textContent = message || ""
      feedbackEl.classList.remove(
        "exercise-form__feedback--error",
        "exercise-form__feedback--success"
      )
      if (!message) return
      if (type === "error") feedbackEl.classList.add("exercise-form__feedback--error")
      else if (type === "success") feedbackEl.classList.add("exercise-form__feedback--success")
    }

    function renderLastAttempt(data) {
      if (!lastAttemptEl) return
      while (lastAttemptEl.firstChild) lastAttemptEl.removeChild(lastAttemptEl.firstChild)
      if (!data || !data.timestamp) {
        lastAttemptEl.setAttribute("hidden", "hidden")
        return
      }
      var formatted = formatTimestamp(data.timestamp)
      if (!formatted) {
        lastAttemptEl.setAttribute("hidden", "hidden")
        return
      }
      lastAttemptEl.removeAttribute("hidden")
      lastAttemptEl.appendChild(document.createTextNode("Last submission: " + formatted + " "))
      var icon = document.createElement("span")
      icon.className = "exercise-form__last-attempt-icon"
      icon.setAttribute("aria-hidden", "true")
      icon.textContent = "✅"
      lastAttemptEl.appendChild(icon)
      if (emailInput && data.email) {
        emailHistory = addContactHistory(emailHistory, data.email, 10)
        writeStoredList(emailHistoryKey, emailHistory)
        rememberContactValue(emailInput, data.email, emailListId)
      }
      if (studentIdInput && data.studentId) {
        studentHistory = addContactHistory(studentHistory, data.studentId, 10)
        writeStoredList(studentHistoryKey, studentHistory)
        rememberContactValue(studentIdInput, data.studentId, studentListId)
      }
    }

    function isEmailValid() {
      if (!emailInput) return true
      var value = (emailInput.value || "").trim()
      if (!value) return false
      if (typeof emailInput.checkValidity === "function") {
        return emailInput.checkValidity()
      }
      return emailPattern.test(value)
    }

    function isStudentIdValid() {
      if (!studentIdInput) return true
      var value = (studentIdInput.value || "").trim()
      if (!value) return false
      if (typeof studentIdInput.checkValidity === "function") {
        try {
          return studentIdInput.checkValidity()
        } catch {
          /* fallback below */
        }
      }
      return /^[a-z]+\d{3}$/.test(value)
    }

    function ensureEmail() {
      if (isEmailValid()) return true
      setFeedback("Enter a valid email address before checking answers.", "error")
      if (emailInput) {
        emailInput.classList.add("exercise-form__email-input--invalid")
        emailInput.focus()
      }
      return false
    }

    function ensureStudentId() {
      if (isStudentIdValid()) return true
      setFeedback(
        "Enter your student ID using lowercase letters followed by three digits (example: abc123) before checking answers.",
        "error"
      )
      if (studentIdInput) {
        studentIdInput.classList.add("exercise-form__email-input--invalid")
        studentIdInput.focus()
      }
      return false
    }

    function ensureContactInfo() {
      if (!ensureEmail()) return false
      return ensureStudentId()
    }

    function allQuestionsComplete() {
      if (!questions.length) return false
      for (var i = 0; i < questions.length; i++) {
        if (!questions[i].complete) return false
      }
      return true
    }

    function updateSubmitState() {
      if (!submitButton) return
      var ready = allQuestionsComplete() && isEmailValid() && isStudentIdValid()
      if (submitRow && submitRow.hasAttribute("hidden")) ready = false
      submitButton.disabled = !ready
      submitButton.setAttribute("aria-disabled", ready ? "false" : "true")
    }

    function updateProgress() {
      if (!progressEl) return
      var count = 0
      for (var i = 0; i < questions.length; i++) {
        if (questions[i].complete) count++
      }
      progressEl.textContent = count + " of " + totalQuestions + " questions completed."
      if (submitRow) {
        if (count === totalQuestions) submitRow.removeAttribute("hidden")
        else submitRow.setAttribute("hidden", "hidden")
      }
      updateSubmitState()
    }

    function clearTimer(question) {
      if (question.flashTimer) {
        clearTimeout(question.flashTimer)
        question.flashTimer = null
      }
    }

    function clearContactInputs() {
      if (emailInput) {
        emailInput.value = ""
        emailInput.defaultValue = ""
        emailInput.classList.remove("exercise-form__email-input--invalid")
      }
      if (studentIdInput) {
        studentIdInput.value = ""
        studentIdInput.defaultValue = ""
        studentIdInput.classList.remove("exercise-form__email-input--invalid")
      }
    }

    function markQuestionIncorrect(question) {
      if (!question) return
      clearTimer(question)
      question.complete = false
      question.pendingReview = false
      question.status = "incorrect"
      if (question.row) {
        question.row.classList.remove(
          "exercise-response-row--correct",
          "exercise-response-row--pending",
          "exercise-response-row--flash-success"
        )
        question.row.classList.add(
          "exercise-response-row--incorrect",
          "exercise-response-row--flash-error"
        )
      }
      for (var i = 0; i < question.inputs.length; i++) {
        var input = question.inputs[i]
        input.readOnly = false
        input.removeAttribute("aria-readonly")
        input.classList.remove("exercise-response-input--locked")
      }
      question.flashTimer = setTimeout(function () {
        if (question.row) question.row.classList.remove("exercise-response-row--flash-error")
      }, 5000)
    }

    function markQuestionCorrect(question) {
      if (!question) return false
      clearTimer(question)
      question.complete = true
      question.pendingReview = false
      question.status = "correct"
      if (question.row) {
        question.row.classList.remove(
          "exercise-response-row--incorrect",
          "exercise-response-row--pending",
          "exercise-response-row--flash-error",
          "exercise-response-row--flash-success"
        )
        question.row.classList.add(
          "exercise-response-row--correct",
          "exercise-response-row--flash-success"
        )
      }
      for (var i = 0; i < question.inputs.length; i++) {
        var input = question.inputs[i]
        input.readOnly = true
        input.setAttribute("aria-readonly", "true")
        input.classList.add("exercise-response-input--locked")
      }
      question.flashTimer = setTimeout(function () {
        if (question.row) question.row.classList.remove("exercise-response-row--flash-success")
      }, 5000)
      return true
    }

    function markQuestionPending(question) {
      if (!question) return
      clearTimer(question)
      question.complete = true
      question.pendingReview = true
      question.status = "pending"
      if (question.row) {
        question.row.classList.remove(
          "exercise-response-row--incorrect",
          "exercise-response-row--correct",
          "exercise-response-row--flash-error",
          "exercise-response-row--flash-success"
        )
        question.row.classList.add("exercise-response-row--pending")
      }
      for (var i = 0; i < question.inputs.length; i++) {
        var input = question.inputs[i]
        input.readOnly = false
        input.removeAttribute("aria-readonly")
        input.classList.remove("exercise-response-input--locked")
      }
    }

    function evaluateQuestion(question) {
      var configEntry = question.answerConfig
      var expected = configEntry ? configEntry.acceptedAnswers : []
      var lengths = configEntry ? configEntry.lengths : []
      var minLength = configEntry ? configEntry.minLength : 1
      var maxLength = configEntry ? configEntry.maxLength : 0
      var allowManual = configEntry ? configEntry.manualReview : false
      var ordered = configEntry ? configEntry.ordered : false
      var normalize = configEntry ? configEntry.normalize !== false : true
      var caseSensitive = configEntry ? configEntry.caseSensitive : false
      var hashAlgorithm = configEntry ? configEntry.hashAlgorithm : null
      if (!configEntry && question.answers.length) {
        expected = [question.answers.slice()]
        lengths = [question.answers.length]
        minLength = question.answers.length || 1
        maxLength = question.answers.length || 0
        allowManual = false
        ordered = false
        normalize = true
        caseSensitive = false
      }
      var filled = []
      for (var i = 0; i < question.inputs.length; i++) {
        var raw = question.inputs[i].value
        var prepared = prepareInputValue(raw, {
          normalize: normalize,
          caseSensitive: caseSensitive,
        })
        if (prepared) {
          filled.push(prepared)
        }
      }
      if (hashAlgorithm && filled.length) {
        var hashedInputs = []
        for (var h = 0; h < filled.length; h++) {
          hashedInputs.push(hashAnswerValue(filled[h], hashAlgorithm))
        }
        filled = hashedInputs
      }
      if (!expected.length && !question.answers.length) {
        if (!filled.length) return { ready: false, correct: false }
        return {
          ready: true,
          correct: false,
          needsReview: allowManual || !question.requireCorrect,
        }
      }
      var minRequired = minLength || 1
      var maxAllowed = maxLength || 0
      if (!maxAllowed && expected.length) {
        for (var comboIndex = 0; comboIndex < expected.length; comboIndex++) {
          if (expected[comboIndex].length > maxAllowed) maxAllowed = expected[comboIndex].length
        }
      }
      if (filled.length < minRequired) {
        return { ready: false, correct: false }
      }
      if (maxAllowed && filled.length > maxAllowed) {
        return { ready: true, correct: false }
      }
      var hasMatchingLength = !lengths.length
      if (!hasMatchingLength) {
        for (var lenIndex = 0; lenIndex < lengths.length; lenIndex++) {
          if (lengths[lenIndex] === filled.length) {
            hasMatchingLength = true
            break
          }
        }
      }
      if (!hasMatchingLength) {
        return { ready: true, correct: false }
      }
      for (var comboIdx = 0; comboIdx < expected.length; comboIdx++) {
        var combo = expected[comboIdx]
        if (!combo || combo.length !== filled.length) continue
        if (ordered) {
          var orderedMatch = true
          for (var fillIndex = 0; fillIndex < filled.length; fillIndex++) {
            if (combo[fillIndex] !== filled[fillIndex]) {
              orderedMatch = false
              break
            }
          }
          if (orderedMatch) return { ready: true, correct: true }
        } else {
          var remaining = combo.slice()
          var matchedAll = true
          for (var x = 0; x < filled.length; x++) {
            var value = filled[x]
            var index = -1
            for (var r = 0; r < remaining.length; r++) {
              if (remaining[r] === value) {
                index = r
                break
              }
            }
            if (index === -1) {
              matchedAll = false
              break
            }
            remaining.splice(index, 1)
          }
          if (matchedAll && !remaining.length) return { ready: true, correct: true }
        }
      }
      if (allowManual || !question.requireCorrect) {
        return { ready: true, correct: false, needsReview: true }
      }
      return { ready: true, correct: false }
    }

    function guardQuestion(question) {
      if (!question) return true
      if (question.status === "correct") return true
      if (!ensureContactInfo()) return false
      var result = evaluateQuestion(question)
      if (!result.ready) {
        markQuestionIncorrect(question)
        setFeedback("Question " + question.id + ": fill in every answer before checking.", "error")
        updateSubmitState()
        return false
      }
      if (!result.correct) {
        if (result.needsReview) {
          markQuestionPending(question)
          setFeedback(
            "Question " + question.id + ": answer recorded and flagged for review.",
            "success"
          )
          updateProgress()
          return true
        }
        markQuestionIncorrect(question)
        setFeedback("Question " + question.id + ": at least one answer is incorrect.", "error")
        updateSubmitState()
        return false
      }
      markQuestionCorrect(question)
      setFeedback("Question " + question.id + " unlocked!", "success")
      updateProgress()
      return true
    }

    function onToggleClick(event) {
      var toggle = event.currentTarget
      var question = toggle ? toggle._exerciseQuestion : null
      var allowed = guardQuestion(question)
      if (!allowed) {
        event.preventDefault()
        event.stopImmediatePropagation()
        event.stopPropagation()
        return false
      }
      return true
    }

    function onToggleKeydown(event) {
      var key = event.key || event.code
      if (key === " ") key = "Space"
      if (key === "Spacebar") key = "Space"
      if (key !== "Enter" && key !== "Space") return
      var toggle = event.currentTarget
      var question = toggle ? toggle._exerciseQuestion : null
      var allowed = guardQuestion(question)
      if (!allowed) {
        event.preventDefault()
        event.stopImmediatePropagation()
        event.stopPropagation()
        return false
      }
      return true
    }

    function attachGuards() {
      for (var i = 0; i < questions.length; i++) {
        var question = questions[i]
        if (!question.toggle) continue
        question.toggle._exerciseQuestion = question
        question.toggle.addEventListener("click", onToggleClick, true)
        question.toggle.addEventListener("keydown", onToggleKeydown, true)
      }
    }

    function closePanel(question) {
      if (!question || !question.panel) return
      question.panel.classList.remove("in", "show")
      question.panel.classList.add("collapse")
      question.panel.style.height = "0px"
      question.panel.style.display = ""
      question.panel.setAttribute("aria-hidden", "true")
      if (question.toggle) question.toggle.setAttribute("aria-expanded", "false")
    }

    function resetQuestion(question) {
      clearTimer(question)
      question.complete = false
      question.pendingReview = false
      question.status = "incomplete"
      if (question.row) {
        question.row.classList.remove(
          "exercise-response-row--correct",
          "exercise-response-row--incorrect",
          "exercise-response-row--pending",
          "exercise-response-row--flash-success",
          "exercise-response-row--flash-error"
        )
      }
      for (var i = 0; i < question.inputs.length; i++) {
        var input = question.inputs[i]
        input.readOnly = false
        input.removeAttribute("aria-readonly")
        input.classList.remove("exercise-response-input--locked")
        input.value = ""
      }
      closePanel(question)
    }

    function resetExercise() {
      for (var i = 0; i < questions.length; i++) resetQuestion(questions[i])
      clearContactInputs()
      updateProgress()
      clearFeedback()
      updateSubmitState()
    }

    function collectPayload() {
      var answersPayload = []
      for (var i = 0; i < questions.length; i++) {
        var question = questions[i]
        var values = []
        for (var j = 0; j < question.inputs.length; j++) {
          values.push(question.inputs[j].value || "")
        }
        answersPayload.push({
          id: question.id,
          answers: values,
          status: question.status,
          needsReview: !!question.pendingReview,
        })
      }
      return {
        email: emailInput ? (emailInput.value || "").trim() : "",
        studentId: studentIdInput ? (studentIdInput.value || "").trim() : "",
        pageTitle: document.title,
        completedAt: new Date().toISOString(),
        recipients: config.recipients.slice(),
        answers: answersPayload,
      }
    }

    function sendSubmission(payload) {
      if (!config.submitUrl) return Promise.resolve()
      if (window.fetch) {
        return window
          .fetch(config.submitUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          .then(function (response) {
            if (!response.ok) throw new Error("Submission failed")
            return response
          })
      }
      return new Promise(function (resolve, reject) {
        try {
          var xhr = new XMLHttpRequest()
          xhr.open("POST", config.submitUrl, true)
          xhr.setRequestHeader("Content-Type", "application/json")
          xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText)
            else reject(new Error("Submission failed"))
          }
          xhr.onerror = function () {
            reject(new Error("Submission failed"))
          }
          xhr.send(JSON.stringify(payload))
        } catch (err) {
          reject(err)
        }
      })
    }

    function handleSubmit(event) {
      event.preventDefault()
      if (!allQuestionsComplete()) {
        setFeedback("Finish every question before submitting.", "error")
        return false
      }
      if (!ensureContactInfo()) return false
      if (submitButton) submitButton.disabled = true
      var payload = collectPayload()
      setFeedback("Submitting answers...", "success")
      return sendSubmission(payload)
        .then(function () {
          var stored = {
            timestamp: Date.now(),
            email: payload.email,
            studentId: payload.studentId,
            answers: payload.answers,
          }
          writeStoredAttempt(storageKey, stored)
          emailHistory = addContactHistory(emailHistory, payload.email, 10)
          studentHistory = addContactHistory(studentHistory, payload.studentId, 10)
          writeStoredList(emailHistoryKey, emailHistory)
          writeStoredList(studentHistoryKey, studentHistory)
          rememberContactValue(emailInput, payload.email, emailListId)
          rememberContactValue(studentIdInput, payload.studentId, studentListId)
          renderLastAttempt(stored)
          resetExercise()
          setFeedback(
            "All answers submitted successfully. Answers have been cleared for your next attempt.",
            "success"
          )
          updateSubmitState()
          return true
        })
        .catch(function () {
          setFeedback("We could not submit your answers. Please try again.", "error")
          updateSubmitState()
          return false
        })
    }

    var storedAttempt = readStoredAttempt(storageKey)
    renderLastAttempt(storedAttempt)
    attachGuards()
    updateProgress()
    clearFeedback()
    updateSubmitState()

    if (emailInput) {
      emailInput.addEventListener("input", function () {
        emailInput.classList.remove("exercise-form__email-input--invalid")
        updateSubmitState()
      })
      emailInput.addEventListener("blur", function () {
        if (isEmailValid()) emailInput.classList.remove("exercise-form__email-input--invalid")
      })
    }

    if (studentIdInput) {
      studentIdInput.addEventListener("input", function () {
        studentIdInput.classList.remove("exercise-form__email-input--invalid")
        updateSubmitState()
      })

      studentIdInput.addEventListener("blur", function () {
        if (isStudentIdValid())
          studentIdInput.classList.remove("exercise-form__email-input--invalid")
      })
    }

    form.addEventListener("submit", function (event) {
      handleSubmit(event)
    })
  })
})()
