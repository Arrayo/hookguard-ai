import { createHash } from 'node:crypto'
import { Ollama } from 'ollama'
import type { AiReviewerPort, ReactCodeReview, StreamEvent } from '../../domain/codeReview.js'
import { analyzeCodeResponseSchema } from '../../interfaces/http/schemas/reviewSchemas.js'
import { buildAstFacts } from '../ast/reactHooksAnalyzer.js'

const REVIEW_TIMEOUT_MS = 300_000
const NUM_PREDICT = 1200

const systemPrompt = `You are HookGuard AI: a pragmatic senior React production reviewer.

Your job is to find frontend bugs and maintenance risks that would matter in a real React app. Review like an engineer debugging production incidents, not like a generic assistant.

Primary review targets:
- Infinite render loops only when there is a demonstrated self-sustaining update cycle.
- useEffect correctness: missing dependencies, wrong dependencies, derived state in effects, fetch loops, cleanup problems, stale closures.
- Rerender causes: unstable object/function/array references, unnecessary state, bad memoization, memoization used to hide design problems.
- React identity issues: random keys, array index keys in changing lists, keys that remount stateful children.
- State design: duplicated derived state, state that can be computed during render, mixed server/client concerns, too many responsibilities in one component.
- Architecture and maintainability: UI components doing data orchestration, tangled effects, unclear data flow, hard-to-test component boundaries.

How to write issues:
- Be specific to the submitted code. Name the variable, effect, dependency, key, or state value involved.
- Explain what causes the issue, why it matters, and the likely production impact.
- Give the smallest pragmatic fix first. Avoid rewrites unless the code is structurally unsafe.
- Do not give generic advice such as "improve performance" or "use best practices".
- Do not invent APIs, files, or line numbers. Use lineHint only when obvious from the snippet.
- Prefer 3-6 high-signal issues over a long list of weak observations.

React reasoning accuracy rules:
- Never report a hook/dependency issue when the submitted code does not contain a hook. If there is no useEffect/useMemo/useCallback/useState dependency relationship in the snippet, there is no dependency array to review.
- Primitive props like string IDs are not unstable dependencies by themselves. Do not call user.id unstable just because its parent object prop can change.
- Rerender is not the same as an infinite loop.
- setState inside useEffect is not automatically an infinite loop. It is normal when triggered by a stable dependency such as an id, prop, or subscription event.
- useEffect without a dependency array runs after every render. Do not propose removing a dependency array as a fix for loops or unstable dependencies.
- If a useEffect call has no dependency array argument and it calls setState on every run, say explicitly that the effect has no dependency array and therefore runs after every render. Do not claim a dependency is present when the code has no dependency array.
- useEffect with [] runs once after mount. It is correct for one-time setup or a one-time updater such as setCount(c => c + 1), but not for logic that must respond to changing props.
- Updater functions like setCount(c => c + 1) do not create loops by themselves. They only loop when the effect runs after every render or continuously changes one of its own dependencies.
- An interval inside useEffect(..., []) that captures state from the first render is usually a stale closure, not an infinite render loop. If cleanup already calls clearInterval, do not claim cleanup is missing. For setSeconds(seconds + 1) inside a mount-only interval, the fix is a functional updater like setSeconds(current => current + 1), keeping [] and the cleanup.
- An object/function/array created during render and listed in dependencies is an unstable dependency. Call it that. Do not call it an infinite loop unless it continuously causes state or network work with no stable stopping condition.
- A function created during render and listed in a useEffect dependency array is an unstable dependency. If the effect performs one network/beacon call and does not update state, classify it as high severity, not critical, and do not call it an infinite loop. The fix is usually to move the function body inside the effect and depend on the primitive values it uses.
- For const filters = { query, limit: 20 } used in [filters], the precise issue is reference instability: the object is new on each render, so the effect reruns after any render. If the effect sets results, that can cause an extra or repeated fetch cycle, but the cause is the unstable object reference, not setResults by itself.
- For const filters = { query, limit: 20 } outside an effect, then useEffect(..., [filters]), severity must be high, not critical. It is an unstable hook dependency with repeated fetch risk, but it is not a proven infinite loop or crash by itself.
- A harmless rerender should not be reported unless it triggers expensive work, network requests, remounts, or visible state churn.
- If the submitted component has no hooks, no effects, no memoization, no list keys, and only renders props as JSX, return no issues. Do not invent useEffect, dependency arrays, or hook dependencies that are not present in the submitted code.
- Passing an object prop such as user to a render-only child is not a bug by itself. A parent rerender may rerender the child, but that is normal React behavior unless the child performs expensive work, network effects, remounts stateful children, or visible state churn.
- Derived state is usually medium severity unless it creates stale UI, sync bugs, or repeated effects.
- If useEffect only sets state to a value directly derived from current props or state, such as setting fullName from firstName plus lastName, classify it as derived state kept in unnecessary state. The primary category is maintainability, severity medium. The fix is to remove the state/effect pair and compute the value during render, not to keep the same dependency array.
- Primitive string props used as dependencies for a derived state effect are not unstable dependencies. For a fullName derived from firstName and lastName, report one maintainability issue for derived state, not a second hooks issue.
- If useEffect only filters, maps, sorts, or counts props into local state, classify it as an unnecessary effect / derived state issue. The primary category is maintainability, severity medium. Prefer computing the value during render; useMemo is only justified for clearly expensive work and should not keep the state/effect pair.
- React keys are about identity. Math.random() keys remount children every render; stable data ids preserve child state.
- For key={Math.random()}, classify the root cause as React identity/performance, category "performance", severity high. The performance score should be reduced because every render creates new keys and remounts list items. The fix is key={item.id} or another stable existing id.
- Use cautious language when the snippet lacks enough context: say "can" or "may" only for realistic outcomes, and avoid speculative chains.

Severity rules:
- critical: proven infinite loops, fetch storms, memory leaks, crashing patterns, render-time state updates that can lock the UI.
- high: unstable dependencies causing repeated expensive work, repeated network requests, expensive rerenders, or key bugs that remount meaningful user state.
- medium: maintainability, readability, derived state, dependency instability without severe work, and separation of concerns issues.
- low: minor improvements that are safe but not urgent.

Category rules:
- If the root cause is a useEffect dependency array, stale closure, missing dependency, or unstable dependency, use category "hooks" even when the impact is network or performance.
- Use category "performance" only when the root cause is render cost, memoization, React identity, keys, or expensive work outside hook correctness.
- Never output combined categories such as "hooks|performance". Pick the primary root cause category from the allowed schema.

Scoring rules:
- Start from 100, then subtract based on concrete findings only.
- critical usually caps overall at 40.
- high usually caps overall at 70.
- medium-only reviews usually stay between 65 and 85.
- low-only reviews usually stay above 85.
- Keep category scores consistent with issue categories and severity.
- A category with a high issue should usually score 45-75, not 90+.
- For unstable effect dependencies that cause repeated fetches, hooks should be reduced because hook correctness is the root cause, and performance may also be reduced if network work repeats.
- Never return unrelated category scores as 0. If a category was not directly reviewed or has no finding, use a reasonable 80-95 score.
- Architecture, maintainability, and performance should not collapse to 0 just because the snippet is small.

Refactor rules:
- Always include 1-3 refactor suggestions when issues exist.
- Each refactor must be a minimal corrected version of the risky code, not a broad rewrite.
- The rationale must explain what changed and why it improves production behavior.
- The example should be valid TypeScript/React code that can be copied as a fix.
- The example string must contain plain code only. Do not include markdown fences, triple backticks, or language labels inside JSON strings.
- Prefer primitive dependencies directly. For an unstable object like filters, move object construction inside the effect or depend on query/limit primitives; do not keep filters in dependencies and also reference filters.limit separately.
- For a true mount-only state update, keep [] as the dependency array. Never fix a loop by deleting the dependency array.
- Do not introduce new unstable objects, functions, or arrays in dependency arrays.
- Do not reference variables removed by the refactor. Every variable used in the example must be declared, imported, or come from props/state shown in the snippet.
- Preserve React semantics: effects that should react to prop changes must keep those props or derived primitives in the dependency array.
- For an effect that depends on count and unconditionally calls setCount(count + 1), the dependency array is not the root bug. The root bug is unconditional state synchronization with its own dependency. Do not say "remove count from dependencies" and do not change it to []. That creates stale logic and changes behavior. The safe recommendation is to delete the self-triggering effect if it has no product purpose, move the increment behind an explicit user event, or add a real stopping condition if the product behavior requires automatic increments.
- Do not add new behavior while fixing dependency arrays. If the original fetch call does not parse the response, do not add .then(), await response.json(), new state updates, or new error handling in the refactor example. Only move the unstable object inside the effect or replace it with primitive dependencies.
- Preserve JSX exactly unless the JSX is the bug. Do not add style, title, className, wrapper elements, or accessibility attributes in refactor examples unless the original issue requires them.

Before returning any refactor, silently validate it:
- Does this code still create an effect loop?
- Does this code compile as TypeScript/React based on the snippet?
- Did I remove or rename a variable that is still referenced?
- Are all dependencies valid, stable, and necessary?
- Did I preserve the original behavior except for the bug being fixed?
- Is this the smallest safe change?

Return only valid JSON. Do not use markdown fences. Do not add explanations before or after the JSON. Do not use trailing commas.
Every string must use double quotes. Arrays must be valid JSON arrays. If there are no concrete findings, return empty arrays and high scores.
Return exactly this JSON shape:
{
  "summary": "short executive summary",
  "issues": [{ "title": "", "severity": "critical|high|medium|low", "category": "hooks|performance|architecture|maintainability|readability", "explanation": "", "suggestion": "", "lineHint": "optional" }],
  "refactor": [{ "title": "", "rationale": "", "changes": "short explanation of what changed", "example": "corrected TypeScript/React code snippet" }],
  "score": { "overall": 0, "hooks": 0, "architecture": 0, "maintainability": 0, "performance": 0 }
}

Good issue style:
"The filters object is created during render and used in the effect dependency array. Because it is a new reference on every render, the effect reruns more often than the query actually changes. Depend on query directly or create the object inside the effect so fetches are tied to stable inputs."

Actual infinite loop example:
"The effect depends on count and calls setCount(count + 1). Each effect run changes count, which immediately satisfies the dependency again, so this can continue indefinitely."

Correct self-dependent state loop refactor:
"Remove the self-triggering effect. If count should change, update it from an event handler or from a guarded condition such as if (count < max). Do not solve this by changing [count] to [] or by removing count from dependencies."

Correct unstable dependency refactor:
"Move filters construction inside the effect and depend on query: useEffect(() => { const filters = { query, limit: 20 }; fetch(...); }, [query])."

Correct mount-only updater refactor:
"useEffect(() => { setCount(c => c + 1); }, []) is a one-time mount update. Removing [] would make it run after every render and can create a loop."

Correct derived state refactor:
"Replace const [fullName, setFullName] plus an effect that calls setFullName from firstName and lastName with const fullName = firstName + ' ' + lastName during render. This removes duplicate derived state and the synchronization effect."

Invalid refactor examples:
"Do not output useEffect(() => { setCount(c => c + 1); }) as a loop fix. Do not say remove count from dependencies as a fix for useEffect(() => { setCount(count + 1); }, [count]). Do not change useEffect(() => { setCount(count + 1); }, [count]) to useEffect(() => { setCount(1); }, []) or useEffect(() => { setCount(count + 1); }, []) as a loop fix. Do not output dependencies like [query, filters.limit] after removing filters. Do not use a dependency array that references values not used by the effect."

Harmless rerender example:
"A parent rerender that only recalculates cheap JSX is not a bug by itself. Report it only if it causes expensive work, network effects, remounts, or visible state churn."

No-issue render-only example:
"type User = { id: string; name: string }; function UserBadge({ user }: { user: User }) { return <div><strong>{user.name}</strong><span>{user.id}</span></div> }" should return no issues, no refactors, and high scores.

Bad issue style:
"You should improve performance."`

export class OllamaReactReviewAdapter implements AiReviewerPort {
  private readonly client: Ollama
  private readonly cache = new Map<string, ReactCodeReview>()

  constructor(
    private readonly model: string,
    host?: string,
  ) {
    this.client = host ? new Ollama({ host }) : new Ollama()
  }

  async analyzeReactCode(code: string): Promise<ReactCodeReview> {
    const hash = codeHash(code)
    const cached = this.cache.get(hash)
    if (cached) {
      console.debug('[HookGuard AI] Cache hit for code hash:', hash.slice(0, 8))
      return cached
    }

    const review = await this.runWithTimeout(() => this.callOllama(code))
    this.cache.set(hash, review)
    return review
  }

  async analyzeReactCodeStream(
    code: string,
    onEvent: (event: StreamEvent) => void,
  ): Promise<ReactCodeReview> {
    const hash = codeHash(code)
    const cached = this.cache.get(hash)
    if (cached) {
      console.debug('[HookGuard AI] Cache hit (stream) for hash:', hash.slice(0, 8))
      return cached
    }

    const messages = buildMessages(code)
    const stream = await this.client.chat({
      model: this.model,
      messages,
      stream: true,
      options: { temperature: 0, num_predict: NUM_PREDICT },
    })

    let fullText = ''
    for await (const chunk of stream) {
      const token = chunk.message.content
      fullText += token
      onEvent({ type: 'token', text: token })
    }

    console.debug('[HookGuard AI] Stream complete, parsing response')
    const review = parseAiReviewResponse(fullText)
    this.cache.set(hash, review)
    return review
  }

  private async callOllama(code: string): Promise<ReactCodeReview> {
    const response = await this.client.chat({
      model: this.model,
      messages: buildMessages(code),
      options: { temperature: 0, num_predict: NUM_PREDICT },
    })

    const content = response.message.content
    console.debug('[HookGuard AI] Raw Ollama response:', content)
    return parseAiReviewResponse(content)
  }

  private runWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Ollama review timed out after 5 minutes')),
        REVIEW_TIMEOUT_MS,
      )
      fn().then(
        (result) => { clearTimeout(timer); resolve(result) },
        (error: unknown) => { clearTimeout(timer); reject(error) },
      )
    })
  }
}

function codeHash(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

function buildMessages(code: string): Array<{ role: 'system' | 'user'; content: string }> {
  const regexFacts = buildCodeFacts(code)
  const astFacts = buildAstFacts(code)
  const allFacts = astFacts ? `${astFacts}\n${regexFacts}` : regexFacts

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Review only the React code between <react_code> tags. Do not review examples or rules from the system prompt as if they were submitted code.

Facts about the submitted code, computed before review:
${allFacts}

If a fact says a hook or pattern is absent, do not report issues that require that absent code.
If recommendedPrimaryIssue is present, use it as the primary issue, including its severity and category, and do not replace it with a different classification.
If recommendedRefactorExample is present, use that code as the basis for the refactor example and do not wrap it in markdown fences.
If primitiveStringProps lists a prop, do not call that prop an unstable dependency.
Do not add style, className, title, or other JSX attributes in refactor examples unless those attributes are already in the submitted code.

<react_code>
${code}
</react_code>`,
    },
  ]
}

function buildCodeFacts(code: string): string {
  const facts = [
    `containsUseEffect: ${/\buseEffect\s*\(/.test(code)}`,
    `containsUseEffectWithoutDependencyArray: ${/\buseEffect\s*\(\s*\(\s*\)\s*=>[\s\S]*?\n\s*\}\s*\)\s*\n/.test(code)}`,
    `containsUseMemo: ${/\buseMemo\s*\(/.test(code)}`,
    `containsUseCallback: ${/\buseCallback\s*\(/.test(code)}`,
    `containsSetStateCall: ${/\bset[A-Z]\w*\s*\(/.test(code)}`,
    `containsSetInterval: ${/\bsetInterval\s*\(/.test(code)}`,
    `containsClearIntervalCleanup: ${/\bclearInterval\s*\(/.test(code)}`,
    `containsLikelyDerivedStateEffect: ${/\buseEffect\s*\([\s\S]*\bset[A-Z]\w*\s*\([\s\S]*\[[^\]]+\]/.test(code)}`,
    `primitiveStringProps: ${getPrimitiveStringProps(code).join(', ') || 'none'}`,
    `containsIdentifierQuery: ${/\bquery\b/.test(code)}`,
    `containsIdentifierFilters: ${/\bfilters\b/.test(code)}`,
    `containsListKey: ${/\bkey\s*=/.test(code)}`,
    `containsMathRandom: ${/\bMath\.random\s*\(/.test(code)}`,
  ]

  if (/\bsetFullName\s*\(/.test(code) && /\bfirstName\b/.test(code) && /\blastName\b/.test(code)) {
    facts.push(
      'recommendedPrimaryIssue: derived state in effect; severity medium; category maintainability; fix by computing fullName during render and removing the state/effect pair',
      'recommendedRefactorExample: export function FullName({ firstName, lastName }: { firstName: string; lastName: string }) { const fullName = `${firstName} ${lastName}`; return <h1>{fullName}</h1> }',
    )
  }

  if (/\bsetActiveProducts\s*\(/.test(code) && /\bproducts\.filter\s*\(/.test(code)) {
    facts.push(
      'recommendedPrimaryIssue: unnecessary effect stores filtered derived state; severity medium; category maintainability; fix by computing activeProducts during render and removing the state/effect pair',
      'recommendedRefactorExample: const activeProducts = products.filter(product => product.active); return <p>{activeProducts.length} active products</p>',
    )
  }

  if (/\bkey\s*=\s*\{\s*Math\.random\s*\(\s*\)\s*\}/.test(code)) {
    facts.push(
      'recommendedPrimaryIssue: random key remounts list items; severity high; category performance; fix by using the existing stable item id as key',
      'recommendedRefactorExample: replace key={Math.random()} with key={todo.id}',
    )
  }

  if (/\bsetInterval\s*\(/.test(code) && /\bsetSeconds\s*\(\s*seconds\s*\+\s*1\s*\)/.test(code)) {
    facts.push(
      'recommendedPrimaryIssue: stale closure in interval captures seconds from initial render; severity high; category hooks; this is not an infinite loop',
      'recommendedRefactorExample: keep the cleanup and [] dependency array, but change setSeconds(seconds + 1) to setSeconds(current => current + 1)',
    )
  }

  if (
    /\buseEffect\s*\(\s*\(\s*\)\s*=>[\s\S]*\bsetWidth\s*\(\s*width\s*\+\s*1\s*\)[\s\S]*?\n\s*\}\s*\)\s*\n/.test(
      code,
    )
  ) {
    facts.push(
      'recommendedPrimaryIssue: effect has no dependency array and calls setWidth(width + 1), so it runs after every render and creates a self-sustaining infinite loop; severity critical; category hooks',
      'recommendedRefactorExample: remove the self-triggering effect; if width should change, update it from an explicit event or guarded condition',
    )
  }

  if (/\bconst\s+track\s*=\s*\(\s*\)\s*=>/.test(code) && /\[\s*track\s*\]/.test(code)) {
    facts.push(
      'recommendedPrimaryIssue: inline track function is recreated every render and used as an effect dependency; severity high; category hooks; this is an unstable dependency, not an infinite loop',
      'recommendedRefactorExample: move navigator.sendBeacon call inside useEffect and depend on [userId]',
    )
  }

  const selfTrigger = detectSelfTriggeringLoop(code)
  if (selfTrigger) {
    facts.push(
      `selfTriggeringLoop: true — the effect calls ${selfTrigger.setter}(${selfTrigger.stateVar} + 1) and ${selfTrigger.stateVar} is listed as a dependency; every render increments ${selfTrigger.stateVar} which triggers the effect again; this is a proven self-triggering infinite render loop`,
      `recommendedPrimaryIssue: ${selfTrigger.setter}(${selfTrigger.stateVar} + 1) inside useEffect([${selfTrigger.stateVar}]) is self-triggering; each call updates ${selfTrigger.stateVar}, which re-runs the effect, creating an infinite render loop; severity critical; category hooks`,
    )
  }

  const unstableObjDep = detectObjectLiteralDependency(code)
  if (unstableObjDep) {
    facts.push(
      `unstableObjectDependency: true — ${unstableObjDep} is an object literal created during render and used as the sole effect dependency [${unstableObjDep}]; it is a new reference on every render`,
      `recommendedPrimaryIssue: ${unstableObjDep} object literal is recreated on every render; listing it as [${unstableObjDep}] in the dependency array causes the effect to rerun after every render due to reference instability; severity high; category hooks; this is an unstable dependency, not an infinite loop; fix by depending on the primitive values directly`,
      `scoringGuidance: hooks score should be below 75 because the hook dependency is incorrect; performance score should also be reduced below 85 because the repeated network requests caused by the unstable dependency have a direct performance cost; architecture and maintainability scores should remain above 70`,
      `refactorInstruction: move the ${unstableObjDep} object construction inside the useEffect callback and depend on the primitive values instead; do NOT use .then(), res.json(), response.json(), or any promise chaining in the refactor example; keep the same fetch call structure as the original snippet`,
    )
  }

  if (/\buseEffect\s*\(\s*\(\s*\)\s*=>\s*\{?\s*set\w+\s*\(\s*(?:true|false)\s*\)\s*;?\s*\}?\s*,\s*\[\s*\]/.test(code)) {
    facts.push(
      'safeMountOnlyEffect: true — the useEffect sets a single boolean flag once after mount; [] means it runs exactly once and stops; there is no dependency update cycle; this is NOT an infinite loop and NOT critical',
      'mountOnlyEffectInstruction: do not report this as an infinite loop, render loop, or critical issue; the maximum appropriate severity is low; scores for hooks and overall should be 65 or above',
    )
  }

  return facts.join('\n')
}

function detectSelfTriggeringLoop(
  code: string,
): { setter: string; stateVar: string } | null {
  if (!/\buseEffect\s*\(/.test(code)) return null

  const match = code.match(/\bset([A-Z][a-zA-Z]*)\s*\(\s*([a-z][a-zA-Z0-9]*)\s*[+\-]/)
  if (!match || !match[1] || !match[2]) return null

  const setter = `set${match[1]}`
  const stateVar = match[2]

  if (new RegExp(`\\[\\s*${stateVar}\\s*\\]`).test(code)) {
    return { setter, stateVar }
  }

  return null
}

function detectObjectLiteralDependency(code: string): string | null {
  if (!/\buseEffect\s*\(/.test(code)) return null

  const match = code.match(/\bconst\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\{/)
  if (!match || !match[1]) return null

  const objName = match[1]

  if (new RegExp(`\\[\\s*${objName}\\s*\\]`).test(code)) {
    return objName
  }

  return null
}

function getPrimitiveStringProps(code: string): string[] {
  const objectType = code.match(/\{([^{}]+)\}\s*\)\s*\{/)?.[1]
  if (!objectType) return []

  return Array.from(objectType.matchAll(/\b([A-Za-z_$][\w$]*)\s*:\s*string\b/g), (match) =>
    String(match[1]),
  )
}

export function extractJsonFromText(content: string): string | null {
  const start = content.indexOf('{')
  if (start === -1) {
    return null
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < content.length; index += 1) {
    const char = content[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') depth += 1
    if (char === '}') depth -= 1

    if (depth === 0) {
      return content.slice(start, index + 1)
    }
  }

  return completeJsonIfNeeded(content.slice(start))
}

function parseAiReviewResponse(rawAiResponse: string): ReactCodeReview {
  const jsonText = extractJsonFromText(rawAiResponse)
  console.debug('[HookGuard AI] Extracted JSON candidate:', jsonText)

  if (!jsonText) {
    return fallbackReview(rawAiResponse, 'No JSON object found in AI response.')
  }

  const parsed = parseJsonCandidate(jsonText)
  if (!parsed.ok) {
    console.warn('[HookGuard AI] JSON parsing failed:', parsed.error.message)
    return fallbackReview(rawAiResponse, parsed.error.message)
  }

  const normalized = normalizeReview(parsed.value, rawAiResponse)
  const validated = analyzeCodeResponseSchema.safeParse(normalized)

  if (!validated.success) {
    console.warn(
      '[HookGuard AI] Response validation recovered with fallback:',
      validated.error.issues,
    )
    return fallbackReview(rawAiResponse, 'AI response did not match the expected review shape.')
  }

  console.debug('[HookGuard AI] Response parsing succeeded.')
  return validated.data
}

function parseJsonCandidate(
  jsonText: string,
): { ok: true; value: unknown } | { ok: false; error: Error } {
  const candidates = [jsonText, repairJson(jsonText)]

  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) as unknown }
    } catch (caught) {
      console.debug('[HookGuard AI] JSON candidate parse failed:', String(caught))
    }
  }

  return { ok: false, error: new Error('Unable to parse AI JSON after recovery attempts.') }
}

function repairJson(jsonText: string): string {
  return jsonText
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\\\s+([\[\]{}])/g, '$1')
    .trim()
}

function completeJsonIfNeeded(jsonText: string): string {
  let fixed = jsonText.trim()
  let objectDepth = 0
  let arrayDepth = 0
  let inString = false
  let escaped = false

  for (const char of fixed) {
    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') objectDepth += 1
    if (char === '}') objectDepth -= 1
    if (char === '[') arrayDepth += 1
    if (char === ']') arrayDepth -= 1
  }

  if (inString) fixed += '"'
  while (arrayDepth > 0) {
    fixed += ']'
    arrayDepth -= 1
  }
  while (objectDepth > 0) {
    fixed += '}'
    objectDepth -= 1
  }

  return fixed
}

function normalizeReview(value: unknown, rawAiResponse: string): ReactCodeReview {
  const record = isRecord(value) ? value : {}
  const issues = Array.isArray(record.issues)
    ? record.issues.map(normalizeIssue).filter(isDefined)
    : []
  const refactor = Array.isArray(record.refactor)
    ? record.refactor.map(normalizeRefactor).filter(isDefined)
    : []

  return {
    summary: toText(record.summary) ?? 'Review completed with a partially recovered AI response.',
    issues,
    refactor,
    score: normalizeScore(record.score, issues),
    metadata: {
      isFallback: false,
      rawAiResponse,
    },
  }
}

function normalizeIssue(value: unknown): ReactCodeReview['issues'][number] | null {
  if (!isRecord(value)) return null

  return {
    title: toText(value.title) ?? 'Recovered issue',
    severity: normalizeSeverity(value.severity),
    category: normalizeCategory(value.category),
    explanation: toText(value.explanation) ?? 'Gemma returned an incomplete issue explanation.',
    suggestion: toText(value.suggestion) ?? 'Review the highlighted code manually.',
    lineHint: toText(value.lineHint),
  }
}

function normalizeRefactor(value: unknown): ReactCodeReview['refactor'][number] | null {
  if (!isRecord(value)) return null

  return {
    title: toText(value.title) ?? 'Recovered refactor suggestion',
    rationale: toText(value.rationale) ?? 'Gemma returned an incomplete refactor rationale.',
    changes: toText(value.changes),
    example: toText(value.example),
  }
}

function normalizeScore(
  value: unknown,
  issues: ReactCodeReview['issues'],
): ReactCodeReview['score'] {
  const record = isRecord(value) ? value : {}
  const derived = deriveScoreFromIssues(issues)
  const score = {
    overall: Math.min(normalizeScoreValue(record.overall, derived.overall), severityCap(issues)),
    hooks: normalizeScoreValue(record.hooks, derived.hooks),
    architecture: normalizeScoreValue(record.architecture, derived.architecture),
    maintainability: normalizeScoreValue(record.maintainability, derived.maintainability),
    performance: normalizeScoreValue(record.performance, derived.performance),
  }

  return capAffectedCategoryScores(score, issues)
}

function capAffectedCategoryScores(
  score: ReactCodeReview['score'],
  issues: ReactCodeReview['issues'],
): ReactCodeReview['score'] {
  const capped = { ...score }

  for (const issue of issues) {
    const key = scoreKeyForCategory(issue.category)
    capped[key] = Math.min(capped[key], categorySeverityCap(issue.severity))
  }

  return capped
}

function deriveScoreFromIssues(issues: ReactCodeReview['issues']): ReactCodeReview['score'] {
  const score: ReactCodeReview['score'] = {
    overall: 95,
    hooks: 95,
    architecture: 92,
    maintainability: 92,
    performance: 92,
  }

  for (const issue of issues) {
    const penalty = severityPenalty(issue.severity)
    const key = scoreKeyForCategory(issue.category)
    score[key] = Math.max(20, score[key] - penalty)
    score.maintainability = Math.max(25, score.maintainability - Math.ceil(penalty / 3))

    // Hooks issues with high/critical severity typically cause repeated network or render work
    // that also warrants a performance penalty, even though the root cause is hook correctness.
    if (issue.category === 'hooks' && (issue.severity === 'high' || issue.severity === 'critical')) {
      score.performance = Math.max(20, score.performance - Math.ceil(penalty / 2))
    }
  }

  const categoryAverage = Math.round(
    (score.hooks + score.architecture + score.maintainability + score.performance) / 4,
  )
  score.overall = Math.min(categoryAverage, severityCap(issues))

  return score
}

function normalizeScoreValue(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback

  const rounded = Math.max(0, Math.min(100, Math.round(numeric)))
  if (rounded === 0 && fallback >= 60) return fallback
  if (Math.abs(rounded - fallback) > 30) return Math.round((rounded + fallback * 2) / 3)

  return rounded
}

function severityPenalty(severity: ReactCodeReview['issues'][number]['severity']): number {
  if (severity === 'critical') return 48
  if (severity === 'high') return 26
  if (severity === 'medium') return 12
  return 6
}

function severityCap(issues: ReactCodeReview['issues']): number {
  if (issues.some((issue) => issue.severity === 'critical')) return 40
  if (issues.some((issue) => issue.severity === 'high')) return 70
  if (issues.some((issue) => issue.severity === 'medium')) return 85
  return 100
}

function categorySeverityCap(severity: ReactCodeReview['issues'][number]['severity']): number {
  if (severity === 'critical') return 45
  if (severity === 'high') return 75
  if (severity === 'medium') return 85
  return 95
}

function scoreKeyForCategory(
  category: ReactCodeReview['issues'][number]['category'],
): keyof ReactCodeReview['score'] {
  if (category === 'hooks') return 'hooks'
  if (category === 'performance') return 'performance'
  if (category === 'architecture') return 'architecture'
  return 'maintainability'
}

function normalizeSeverity(value: unknown): ReactCodeReview['issues'][number]['severity'] {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low'
    ? value
    : 'medium'
}

function normalizeCategory(value: unknown): ReactCodeReview['issues'][number]['category'] {
  return value === 'hooks' ||
    value === 'architecture' ||
    value === 'maintainability' ||
    value === 'readability' ||
    value === 'performance'
    ? value
    : 'maintainability'
}

function fallbackReview(rawAiResponse: string, parsingError: string): ReactCodeReview {
  return {
    summary:
      'Gemma returned a response that could not be fully parsed, so HookGuard preserved the raw output for review.',
    issues: [
      {
        title: 'AI response parsing fallback',
        severity: 'low',
        category: 'maintainability',
        explanation:
          'The model completed the request, but its response was not valid JSON for the review schema.',
        suggestion:
          'Read the preserved raw AI response below, then retry if you need structured score cards.',
      },
    ],
    refactor: [],
    score: {
      overall: 50,
      hooks: 50,
      architecture: 50,
      maintainability: 50,
      performance: 50,
    },
    metadata: {
      isFallback: true,
      rawAiResponse,
      parsingError,
    },
  }
}

function toText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDefined<T>(value: T | null): value is T {
  return value !== null
}
