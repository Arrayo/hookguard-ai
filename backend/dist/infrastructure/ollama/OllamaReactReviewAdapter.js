import { Ollama } from 'ollama';
import { analyzeCodeResponseSchema } from '../../interfaces/http/schemas/reviewSchemas.js';
const systemPrompt = `You are HookGuard AI, a senior React reviewer focused on practical feedback.
Analyze React and TypeScript code for hooks correctness, render loops, architecture, maintainability, and pragmatic refactoring opportunities.
Return only valid JSON. Do not use markdown fences. Do not add explanations before or after the JSON. Do not use trailing commas.
Every string must use double quotes. Arrays must be valid JSON arrays. If you are unsure, return an empty array for issues or refactor.
Return exactly this JSON shape:
{
  "summary": "short executive summary",
  "issues": [{ "title": "", "severity": "critical|high|medium|low", "category": "hooks|architecture|render-loop|maintainability|performance", "explanation": "", "suggestion": "", "lineHint": "optional" }],
  "refactor": [{ "title": "", "rationale": "", "example": "optional short code snippet" }],
  "score": { "overall": 0, "hooks": 0, "architecture": 0, "maintainability": 0, "performance": 0 }
}
Prefer concrete, minimal suggestions. Do not invent line numbers if they are not obvious.`;
export class OllamaReactReviewAdapter {
    model;
    client;
    constructor(model, host) {
        this.model = model;
        this.client = host ? new Ollama({ host }) : new Ollama();
    }
    async analyzeReactCode(code) {
        const response = await this.client.chat({
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Review this React code:\n\n${code}` },
            ],
            options: {
                temperature: 0.2,
            },
        });
        const content = response.message.content;
        console.debug('[HookGuard AI] Raw Ollama response:', content);
        return parseAiReviewResponse(content);
    }
}
export function extractJsonFromText(content) {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        return completeJsonIfNeeded(fenced[1].trim());
    }
    const start = content.indexOf('{');
    if (start === -1) {
        return null;
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < content.length; index += 1) {
        const char = content[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString)
            continue;
        if (char === '{')
            depth += 1;
        if (char === '}')
            depth -= 1;
        if (depth === 0) {
            return content.slice(start, index + 1);
        }
    }
    return completeJsonIfNeeded(content.slice(start));
}
function parseAiReviewResponse(rawAiResponse) {
    const jsonText = extractJsonFromText(rawAiResponse);
    console.debug('[HookGuard AI] Extracted JSON candidate:', jsonText);
    if (!jsonText) {
        return fallbackReview(rawAiResponse, 'No JSON object found in AI response.');
    }
    const parsed = parseJsonCandidate(jsonText);
    if (!parsed.ok) {
        console.warn('[HookGuard AI] JSON parsing failed:', parsed.error.message);
        return fallbackReview(rawAiResponse, parsed.error.message);
    }
    const normalized = normalizeReview(parsed.value, rawAiResponse);
    const validated = analyzeCodeResponseSchema.safeParse(normalized);
    if (!validated.success) {
        console.warn('[HookGuard AI] Response validation recovered with fallback:', validated.error.issues);
        return fallbackReview(rawAiResponse, 'AI response did not match the expected review shape.');
    }
    console.debug('[HookGuard AI] Response parsing succeeded.');
    return validated.data;
}
function parseJsonCandidate(jsonText) {
    const candidates = [jsonText, repairJson(jsonText)];
    for (const candidate of candidates) {
        try {
            return { ok: true, value: JSON.parse(candidate) };
        }
        catch (caught) {
            console.debug('[HookGuard AI] JSON candidate parse failed:', String(caught));
        }
    }
    return { ok: false, error: new Error('Unable to parse AI JSON after recovery attempts.') };
}
function repairJson(jsonText) {
    return jsonText
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\/\/.*$/gm, '')
        .replace(/,\s*([}\]])/g, '$1')
        .trim();
}
function completeJsonIfNeeded(jsonText) {
    let fixed = jsonText.trim();
    let objectDepth = 0;
    let arrayDepth = 0;
    let inString = false;
    let escaped = false;
    for (const char of fixed) {
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString)
            continue;
        if (char === '{')
            objectDepth += 1;
        if (char === '}')
            objectDepth -= 1;
        if (char === '[')
            arrayDepth += 1;
        if (char === ']')
            arrayDepth -= 1;
    }
    if (inString)
        fixed += '"';
    while (arrayDepth > 0) {
        fixed += ']';
        arrayDepth -= 1;
    }
    while (objectDepth > 0) {
        fixed += '}';
        objectDepth -= 1;
    }
    return fixed;
}
function normalizeReview(value, rawAiResponse) {
    const record = isRecord(value) ? value : {};
    const issues = Array.isArray(record.issues) ? record.issues.map(normalizeIssue).filter(isDefined) : [];
    const refactor = Array.isArray(record.refactor)
        ? record.refactor.map(normalizeRefactor).filter(isDefined)
        : [];
    return {
        summary: toText(record.summary) ?? 'Review completed with a partially recovered AI response.',
        issues,
        refactor,
        score: normalizeScore(record.score),
        metadata: {
            isFallback: false,
            rawAiResponse,
        },
    };
}
function normalizeIssue(value) {
    if (!isRecord(value))
        return null;
    return {
        title: toText(value.title) ?? 'Recovered issue',
        severity: normalizeSeverity(value.severity),
        category: normalizeCategory(value.category),
        explanation: toText(value.explanation) ?? 'Gemma returned an incomplete issue explanation.',
        suggestion: toText(value.suggestion) ?? 'Review the highlighted code manually.',
        lineHint: toText(value.lineHint),
    };
}
function normalizeRefactor(value) {
    if (!isRecord(value))
        return null;
    return {
        title: toText(value.title) ?? 'Recovered refactor suggestion',
        rationale: toText(value.rationale) ?? 'Gemma returned an incomplete refactor rationale.',
        example: toText(value.example),
    };
}
function normalizeScore(value) {
    const record = isRecord(value) ? value : {};
    return {
        overall: normalizeScoreValue(record.overall),
        hooks: normalizeScoreValue(record.hooks),
        architecture: normalizeScoreValue(record.architecture),
        maintainability: normalizeScoreValue(record.maintainability),
        performance: normalizeScoreValue(record.performance),
    };
}
function normalizeScoreValue(value) {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric))
        return 50;
    return Math.max(0, Math.min(100, Math.round(numeric)));
}
function normalizeSeverity(value) {
    return value === 'critical' || value === 'high' || value === 'medium' || value === 'low'
        ? value
        : 'medium';
}
function normalizeCategory(value) {
    return value === 'hooks' ||
        value === 'architecture' ||
        value === 'render-loop' ||
        value === 'maintainability' ||
        value === 'performance'
        ? value
        : 'maintainability';
}
function fallbackReview(rawAiResponse, parsingError) {
    return {
        summary: 'Gemma returned a response that could not be fully parsed, so HookGuard preserved the raw output for review.',
        issues: [
            {
                title: 'AI response parsing fallback',
                severity: 'low',
                category: 'maintainability',
                explanation: 'The model completed the request, but its response was not valid JSON for the review schema.',
                suggestion: 'Read the preserved raw AI response below, then retry if you need structured score cards.',
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
    };
}
function toText(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    return undefined;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isDefined(value) {
    return value !== null;
}
