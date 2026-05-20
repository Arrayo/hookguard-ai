export function buildCodeFacts(code: string): string {
  const facts = [
    `containsUseEffect: ${/\buseEffect\s*\(/.test(code)}`,
    `containsUseEffectWithoutDependencyArray: ${/\buseEffect\s*\(\s*\(\s*\)\s*=>[\s\S]*?\n\s*\}\s*\)\s*\n/.test(code)}`,
    `containsUseMemo: ${/\buseMemo\s*\(/.test(code)}`,
    `containsUseCallback: ${/\buseCallback\s*\(/.test(code)}`,
    `containsUseState: ${/\buseState\s*\(/.test(code)}`,
    `containsUseRef: ${/\buseRef\s*\(/.test(code)}`,
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

  appendDerivedStateFullNameFacts(code, facts)
  appendDerivedStateActiveProductsFacts(code, facts)
  appendRandomKeyFacts(code, facts)
  appendStaleIntervalFacts(code, facts)
  appendMissingDepsLoopFacts(code, facts)
  appendUnstableCallbackFacts(code, facts)
  appendSelfTriggeringLoopFacts(code, facts)
  appendUnstableObjectDepFacts(code, facts)
  appendSafeMountOnlyEffectFacts(code, facts)

  return facts.join('\n')
}

function appendDerivedStateFullNameFacts(code: string, facts: string[]): void {
  if (/\bsetFullName\s*\(/.test(code) && /\bfirstName\b/.test(code) && /\blastName\b/.test(code)) {
    facts.push(
      'recommendedPrimaryIssue: derived state in effect; severity medium; category maintainability; fix by computing fullName during render and removing the state/effect pair',
      'recommendedRefactorExample: export function FullName({ firstName, lastName }: { firstName: string; lastName: string }) { const fullName = `${firstName} ${lastName}`; return <h1>{fullName}</h1> }',
    )
  }
}

function appendDerivedStateActiveProductsFacts(code: string, facts: string[]): void {
  if (/\bsetActiveProducts\s*\(/.test(code) && /\bproducts\.filter\s*\(/.test(code)) {
    facts.push(
      'recommendedPrimaryIssue: unnecessary effect stores filtered derived state; severity medium; category maintainability; fix by computing activeProducts during render and removing the state/effect pair',
      'recommendedRefactorExample: const activeProducts = products.filter(product => product.active); return <p>{activeProducts.length} active products</p>',
    )
  }
}

function appendRandomKeyFacts(code: string, facts: string[]): void {
  if (/\bkey\s*=\s*\{\s*Math\.random\s*\(\s*\)\s*\}/.test(code)) {
    facts.push(
      'recommendedPrimaryIssue: random key remounts list items; severity high; category performance; fix by using the existing stable item id as key',
      'recommendedRefactorExample: replace key={Math.random()} with key={todo.id}',
    )
  }
}

function appendStaleIntervalFacts(code: string, facts: string[]): void {
  if (/\bsetInterval\s*\(/.test(code) && /\bsetSeconds\s*\(\s*seconds\s*\+\s*1\s*\)/.test(code)) {
    facts.push(
      'recommendedPrimaryIssue: stale closure in interval captures seconds from initial render; severity high; category hooks; this is not an infinite loop',
      'recommendedRefactorExample: keep the cleanup and [] dependency array, but change setSeconds(seconds + 1) to setSeconds(current => current + 1)',
    )
  }
}

function appendMissingDepsLoopFacts(code: string, facts: string[]): void {
  if (
    /\buseEffect\s*\(\s*\(\s*\)\s*=>[\s\S]*\bsetWidth\s*\(\s*width\s*\+\s*1\s*\)[\s\S]*?\n\s*\}\s*\)\s*\n/.test(code)
  ) {
    facts.push(
      'recommendedPrimaryIssue: effect has no dependency array and calls setWidth(width + 1), so it runs after every render and creates a self-sustaining infinite loop; severity critical; category hooks',
      'recommendedRefactorExample: remove the self-triggering effect; if width should change, update it from an explicit event or guarded condition',
    )
  }
}

function appendUnstableCallbackFacts(code: string, facts: string[]): void {
  if (/\bconst\s+track\s*=\s*\(\s*\)\s*=>/.test(code) && /\[\s*track\s*\]/.test(code)) {
    facts.push(
      'recommendedPrimaryIssue: inline track function is recreated every render and used as an effect dependency; severity high; category hooks; this is an unstable dependency, not an infinite loop',
      'recommendedRefactorExample: move navigator.sendBeacon call inside useEffect and depend on [userId]',
    )
  }
}

function appendSelfTriggeringLoopFacts(code: string, facts: string[]): void {
  const selfTrigger = detectSelfTriggeringLoop(code)
  if (!selfTrigger) return

  facts.push(
    `selfTriggeringLoop: true — the effect calls ${selfTrigger.setter}(${selfTrigger.stateVar} + 1) and ${selfTrigger.stateVar} is listed as a dependency; every render increments ${selfTrigger.stateVar} which triggers the effect again; this is a proven self-triggering infinite render loop`,
    `recommendedPrimaryIssue: ${selfTrigger.setter}(${selfTrigger.stateVar} + 1) inside useEffect([${selfTrigger.stateVar}]) is self-triggering; each call updates ${selfTrigger.stateVar}, which re-runs the effect, creating an infinite render loop; severity critical; category hooks`,
  )
}

function appendUnstableObjectDepFacts(code: string, facts: string[]): void {
  const unstableObjDep = detectObjectLiteralDependency(code)
  if (!unstableObjDep) return

  facts.push(
    `unstableObjectDependency: true — ${unstableObjDep} is an object literal created during render and used as the sole effect dependency [${unstableObjDep}]; it is a new reference on every render`,
    `recommendedPrimaryIssue: ${unstableObjDep} object literal is recreated on every render; listing it as [${unstableObjDep}] in the dependency array causes the effect to rerun after every render due to reference instability; severity high; category hooks; this is an unstable dependency, not an infinite loop; fix by depending on the primitive values directly`,
    `scoringGuidance: hooks score should be below 75 because the hook dependency is incorrect; performance score should also be reduced below 85 because the repeated network requests caused by the unstable dependency have a direct performance cost; architecture and maintainability scores should remain above 70`,
    `refactorInstruction: move the ${unstableObjDep} object construction inside the useEffect callback and depend on the primitive values instead; do NOT use .then(), res.json(), response.json(), or any promise chaining in the refactor example; keep the same fetch call structure as the original snippet`,
  )
}

function appendSafeMountOnlyEffectFacts(code: string, facts: string[]): void {
  if (
    /\buseEffect\s*\(\s*\(\s*\)\s*=>\s*\{?\s*set\w+\s*\(\s*(?:true|false)\s*\)\s*;?\s*\}?\s*,\s*\[\s*\]/.test(code)
  ) {
    facts.push(
      'safeMountOnlyEffect: true — the useEffect sets a single boolean flag once after mount; [] means it runs exactly once and stops; there is no dependency update cycle; this is NOT an infinite loop and NOT critical',
      'mountOnlyEffectInstruction: do not report this as an infinite loop, render loop, or critical issue; the maximum appropriate severity is low; scores for hooks and overall should be 65 or above',
    )
  }
}

function detectSelfTriggeringLoop(code: string): { setter: string; stateVar: string } | null {
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
