import { describe, expect, it } from 'vitest'
import type { RuleCondition } from '../src/db/types'
import { evaluateCondition, evaluateConditions } from '../src/modules/rules/conditionEvaluator'
import type { RuleContext } from '../src/modules/rules/types'

// Mock context factory
function createMockContext(payload: Record<string, unknown>): RuleContext {
    return {
        payload,
        getActivityById: async () => null,
        getHabitById: async () => null,
        getCurrentTime: () => Date.now(),
        getTodayKey: () => '2025-01-01',
    }
}

describe('evaluateCondition', () => {
    describe('eq operator', () => {
        it('eşit değerler için true döndürmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.status',
                operator: 'eq',
                value: 'active',
            }
            const context = createMockContext({ status: 'active' })

            expect(evaluateCondition(condition, context)).toBe(true)
        })

        it('eşit olmayan değerler için false döndürmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.status',
                operator: 'eq',
                value: 'active',
            }
            const context = createMockContext({ status: 'inactive' })

            expect(evaluateCondition(condition, context)).toBe(false)
        })
    })

    describe('neq operator', () => {
        it('farklı değerler için true döndürmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.status',
                operator: 'neq',
                value: 'active',
            }
            const context = createMockContext({ status: 'inactive' })

            expect(evaluateCondition(condition, context)).toBe(true)
        })
    })

    describe('gt operator', () => {
        it('büyük değer için true döndürmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.durationSec',
                operator: 'gt',
                value: 100,
            }
            const context = createMockContext({ durationSec: 150 })

            expect(evaluateCondition(condition, context)).toBe(true)
        })

        it('eşit değer için false döndürmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.durationSec',
                operator: 'gt',
                value: 100,
            }
            const context = createMockContext({ durationSec: 100 })

            expect(evaluateCondition(condition, context)).toBe(false)
        })
    })

    describe('gte operator', () => {
        it('eşit değer için true döndürmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.durationSec',
                operator: 'gte',
                value: 100,
            }
            const context = createMockContext({ durationSec: 100 })

            expect(evaluateCondition(condition, context)).toBe(true)
        })
    })

    describe('lt operator', () => {
        it('küçük değer için true döndürmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.count',
                operator: 'lt',
                value: 10,
            }
            const context = createMockContext({ count: 5 })

            expect(evaluateCondition(condition, context)).toBe(true)
        })
    })

    describe('lte operator', () => {
        it('eşit değer için true döndürmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.count',
                operator: 'lte',
                value: 10,
            }
            const context = createMockContext({ count: 10 })

            expect(evaluateCondition(condition, context)).toBe(true)
        })
    })

    describe('contains operator', () => {
        it('string içerme için true döndürmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.name',
                operator: 'contains',
                value: 'test',
            }
            const context = createMockContext({ name: 'my-test-activity' })

            expect(evaluateCondition(condition, context)).toBe(true)
        })

        it('array içerme için true döndürmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.tags',
                operator: 'contains',
                value: 'urgent',
            }
            const context = createMockContext({ tags: ['work', 'urgent', 'coding'] })

            expect(evaluateCondition(condition, context)).toBe(true)
        })

        it('içermeme durumunda false döndürmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.name',
                operator: 'contains',
                value: 'xyz',
            }
            const context = createMockContext({ name: 'my-activity' })

            expect(evaluateCondition(condition, context)).toBe(false)
        })
    })

    describe('nested paths', () => {
        it('iç içe değerlere erişmeli', () => {
            const condition: RuleCondition = {
                field: 'payload.session.durationSec',
                operator: 'gte',
                value: 1800,
            }
            const context = createMockContext({
                session: {
                    id: '123',
                    durationSec: 2000,
                },
            })

            expect(evaluateCondition(condition, context)).toBe(true)
        })

        it('olmayan path için undefined dönmeli ve false olmalı', () => {
            const condition: RuleCondition = {
                field: 'payload.nonexistent.deep.path',
                operator: 'eq',
                value: 'test',
            }
            const context = createMockContext({})

            expect(evaluateCondition(condition, context)).toBe(false)
        })
    })
})

describe('evaluateConditions', () => {
    it('boş koşul listesi için true döndürmeli', () => {
        const context = createMockContext({})
        expect(evaluateConditions([], context)).toBe(true)
    })

    it('tüm koşullar sağlanırsa true döndürmeli (AND mantığı)', () => {
        const conditions: RuleCondition[] = [
            { field: 'payload.status', operator: 'eq', value: 'active' },
            { field: 'payload.count', operator: 'gte', value: 5 },
        ]
        const context = createMockContext({ status: 'active', count: 10 })

        expect(evaluateConditions(conditions, context)).toBe(true)
    })

    it('bir koşul sağlanmazsa false döndürmeli', () => {
        const conditions: RuleCondition[] = [
            { field: 'payload.status', operator: 'eq', value: 'active' },
            { field: 'payload.count', operator: 'gte', value: 5 },
        ]
        const context = createMockContext({ status: 'active', count: 3 })

        expect(evaluateConditions(conditions, context)).toBe(false)
    })
})
