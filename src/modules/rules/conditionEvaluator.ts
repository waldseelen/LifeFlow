import type { RuleCondition } from '@/db/types'
import type { RuleContext } from './types'

/**
 * Deeply get a value from an object using dot notation
 * e.g., "payload.session.durationSec" -> payload.session.durationSec
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.')
    let current: unknown = obj

    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined
        }
        if (typeof current === 'object') {
            current = (current as Record<string, unknown>)[part]
        } else {
            return undefined
        }
    }

    return current
}

/**
 * Evaluate a single condition against the context
 */
export function evaluateCondition(
    condition: RuleCondition,
    context: RuleContext
): boolean {
    const actualValue = getNestedValue(
        { payload: context.payload, context },
        condition.field
    )

    const { operator, value: expectedValue } = condition

    switch (operator) {
        case 'eq':
            return actualValue === expectedValue

        case 'neq':
            return actualValue !== expectedValue

        case 'gt':
            return (
                typeof actualValue === 'number' &&
                typeof expectedValue === 'number' &&
                actualValue > expectedValue
            )

        case 'gte':
            return (
                typeof actualValue === 'number' &&
                typeof expectedValue === 'number' &&
                actualValue >= expectedValue
            )

        case 'lt':
            return (
                typeof actualValue === 'number' &&
                typeof expectedValue === 'number' &&
                actualValue < expectedValue
            )

        case 'lte':
            return (
                typeof actualValue === 'number' &&
                typeof expectedValue === 'number' &&
                actualValue <= expectedValue
            )

        case 'contains':
            if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
                return actualValue.includes(expectedValue)
            }
            if (Array.isArray(actualValue)) {
                return actualValue.includes(expectedValue)
            }
            return false

        default:
            console.warn(`Unknown operator: ${operator}`)
            return false
    }
}

/**
 * Evaluate all conditions (AND logic - all must pass)
 */
export function evaluateConditions(
    conditions: RuleCondition[],
    context: RuleContext
): boolean {
    // Empty conditions array means "always match"
    if (conditions.length === 0) {
        return true
    }

    return conditions.every((condition) => evaluateCondition(condition, context))
}
