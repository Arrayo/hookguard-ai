import { parse } from '@babel/parser'
import * as t from '@babel/types'

type EffectInfo = {
  deps: string[] | null // null = no array (run every render), [] = mount-only
  setterCalls: string[] // state setters called inside this effect
  hasFetchCall: boolean
}

type HooksAnalysis = {
  stateVars: Map<string, string> // value -> setter e.g. count -> setCount
  unstableConstNames: Set<string> // const names whose initializer is {}, [], or () => ...
  effects: EffectInfo[]
  hasSelfTriggeringLoop: boolean
  hasUnstableObjectDep: boolean
  mountOnlyEffects: number
}

function walk(node: t.Node | null | undefined, visitor: (n: t.Node) => boolean | void): void {
  if (!node || typeof node !== 'object') return
  const stop = visitor(node)
  if (stop === false) return
  const record = node as unknown as Record<string, unknown>
  for (const key of Object.keys(record)) {
    const child = record[key]
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) walk(item as t.Node, visitor)
      }
    } else if (child && typeof child === 'object' && 'type' in child) {
      walk(child as t.Node, visitor)
    }
  }
}

function isUnstableInit(node: t.Expression | t.PatternLike): boolean {
  return (
    t.isObjectExpression(node) ||
    t.isArrayExpression(node) ||
    t.isArrowFunctionExpression(node) ||
    t.isFunctionExpression(node)
  )
}

function extractCallName(node: t.CallExpression): string | null {
  if (t.isIdentifier(node.callee)) return node.callee.name
  if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property))
    return node.callee.property.name
  return null
}

function extractDepNames(arrayNode: t.ArrayExpression): string[] {
  const deps: string[] = []
  for (const el of arrayNode.elements) {
    if (!el) continue
    if (t.isIdentifier(el)) deps.push(el.name)
    else if (t.isMemberExpression(el) && t.isIdentifier(el.object)) deps.push(el.object.name)
  }
  return deps
}

function collectSetterCalls(bodyNode: t.Node): string[] {
  const setters: string[] = []
  walk(bodyNode, (n) => {
    if (
      t.isCallExpression(n) &&
      t.isIdentifier(n.callee) &&
      /^set[A-Z]/.test(n.callee.name)
    ) {
      setters.push(n.callee.name)
    }
  })
  return setters
}

function hasFetch(bodyNode: t.Node): boolean {
  let found = false
  walk(bodyNode, (n) => {
    if (
      t.isCallExpression(n) &&
      t.isIdentifier(n.callee) &&
      n.callee.name === 'fetch'
    ) {
      found = true
      return false
    }
  })
  return found
}

function analyzeReactHooks(code: string): HooksAnalysis | null {
  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    })

    const stateVars = new Map<string, string>()
    const unstableConstNames = new Set<string>()
    const effects: EffectInfo[] = []

    walk(ast, (node) => {
      // useState destructuring: const [value, setter] = useState(...)
      if (
        t.isVariableDeclaration(node) &&
        node.kind === 'const'
      ) {
        for (const decl of node.declarations) {
          if (
            t.isArrayPattern(decl.id) &&
            decl.init &&
            t.isCallExpression(decl.init) &&
            t.isIdentifier(decl.init.callee) &&
            decl.init.callee.name === 'useState'
          ) {
            const [valueEl, setterEl] = decl.id.elements
            if (t.isIdentifier(valueEl) && t.isIdentifier(setterEl)) {
              stateVars.set(valueEl.name, setterEl.name)
            }
          }

          // Detect object/array/function consts (potential unstable deps)
          if (
            t.isIdentifier(decl.id) &&
            decl.init &&
            isUnstableInit(decl.init as t.Expression)
          ) {
            unstableConstNames.add(decl.id.name)
          }
        }
      }

      // useEffect(callback, deps?)
      if (
        t.isCallExpression(node) &&
        t.isIdentifier(node.callee) &&
        node.callee.name === 'useEffect'
      ) {
        const [callbackArg, depsArg] = node.arguments
        if (!callbackArg) return

        const bodyNode = callbackArg
        const deps =
          t.isArrayExpression(depsArg) ? extractDepNames(depsArg) :
          depsArg === undefined ? null :
          null

        const setterCalls = collectSetterCalls(bodyNode)
        const hasFetchCall = hasFetch(bodyNode)

        effects.push({ deps, setterCalls, hasFetchCall })
      }
    })

    // Self-triggering: effect depends on a state variable it also updates
    let hasSelfTriggeringLoop = false
    for (const effect of effects) {
      if (!effect.deps) continue
      for (const dep of effect.deps) {
        const setter = stateVars.get(dep)
        if (setter && effect.setterCalls.includes(setter)) {
          hasSelfTriggeringLoop = true
        }
      }
    }

    // Unstable object dep: effect depends on a const that was initialized as {},[],()=>
    let hasUnstableObjectDep = false
    for (const effect of effects) {
      if (!effect.deps) continue
      for (const dep of effect.deps) {
        if (unstableConstNames.has(dep)) {
          hasUnstableObjectDep = true
        }
      }
    }

    const mountOnlyEffects = effects.filter((e) => e.deps?.length === 0).length

    return {
      stateVars,
      unstableConstNames,
      effects,
      hasSelfTriggeringLoop,
      hasUnstableObjectDep,
      mountOnlyEffects,
    }
  } catch {
    return null
  }
}

export function buildAstFacts(code: string): string | null {
  const analysis = analyzeReactHooks(code)
  if (!analysis) return null

  const lines: string[] = ['# AST-derived facts (high confidence)']

  if (analysis.stateVars.size > 0) {
    const pairs = [...analysis.stateVars.entries()].map(([v, s]) => `${v}/${s}`).join(', ')
    lines.push(`stateVarPairs: ${pairs}`)
  }

  if (analysis.unstableConstNames.size > 0) {
    lines.push(`unstableConstDeclarations: ${[...analysis.unstableConstNames].join(', ')}`)
    lines.push('unstableConstNote: These consts are object/array/function literals that create a new reference on every render.')
  }

  for (let i = 0; i < analysis.effects.length; i++) {
    const e = analysis.effects[i]
    if (!e) continue
    const label = `useEffect[${i}]`
    if (e.deps === null) {
      lines.push(`${label}.deps: NONE — runs after every render`)
    } else if (e.deps.length === 0) {
      lines.push(`${label}.deps: [] — mount-only, runs once`)
    } else {
      lines.push(`${label}.deps: [${e.deps.join(', ')}]`)
    }
    if (e.setterCalls.length > 0) lines.push(`${label}.setterCalls: ${e.setterCalls.join(', ')}`)
    if (e.hasFetchCall) lines.push(`${label}.hasFetch: true`)
  }

  if (analysis.hasSelfTriggeringLoop) {
    lines.push('astDetectedPattern: SELF_TRIGGERING_LOOP — a useEffect updates state that is listed in its own deps')
  }

  if (analysis.hasUnstableObjectDep) {
    lines.push('astDetectedPattern: UNSTABLE_CONST_DEP — a useEffect depends on a const initialized with an object/array/function literal')
  }

  if (analysis.mountOnlyEffects > 0 && !analysis.hasSelfTriggeringLoop) {
    lines.push(`mountOnlyEffectCount: ${analysis.mountOnlyEffects} — effect(s) with empty dep array, not a loop risk`)
  }

  return lines.join('\n')
}
