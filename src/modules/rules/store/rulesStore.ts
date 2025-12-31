import { db } from '@/db'
import type { Rule, RuleActionConfig, RuleCondition, RuleTrigger } from '@/db/types'
import { generateId } from '@/shared/utils'
import { create } from 'zustand'
import { ruleEngine } from '../ruleEngine'

// ============================================
// Rules Store
// ============================================

interface RulesState {
    rules: Rule[]
    isLoading: boolean

    // Actions
    initialize: () => Promise<void>
    createRule: (data: {
        name: string
        trigger: RuleTrigger
        conditions: RuleCondition[]
        actions: RuleActionConfig[]
        enabled?: boolean
    }) => Promise<string>
    updateRule: (id: string, data: Partial<Rule>) => Promise<void>
    deleteRule: (id: string) => Promise<void>
    toggleRule: (id: string) => Promise<void>
    duplicateRule: (id: string) => Promise<string>

    // Selectors
    getRuleById: (id: string) => Rule | undefined
    getActiveRules: () => Rule[]
    getRulesByTrigger: (trigger: RuleTrigger) => Rule[]
}

export const useRulesStore = create<RulesState>((set, get) => ({
    rules: [],
    isLoading: true,

    initialize: async () => {
        try {
            const rules = await db.rules.toArray()
            set({ rules, isLoading: false })
        } catch (error) {
            console.error('Failed to initialize rules:', error)
            set({ isLoading: false })
        }
    },

    createRule: async (data) => {
        const id = generateId()
        const now = Date.now()

        const rule: Rule = {
            id,
            name: data.name,
            trigger: data.trigger,
            conditions: data.conditions,
            actions: data.actions,
            enabled: data.enabled ?? true,
            createdAt: now,
            updatedAt: now,
        }

        await db.rules.add(rule)

        set((state) => ({
            rules: [...state.rules, rule],
        }))

        // RuleEngine'e yeni kuralı bildir
        await ruleEngine.reloadRules()

        return id
    },

    updateRule: async (id, data) => {
        const now = Date.now()
        await db.rules.update(id, { ...data, updatedAt: now })

        set((state) => ({
            rules: state.rules.map((r) =>
                r.id === id ? { ...r, ...data, updatedAt: now } : r
            ),
        }))

        // RuleEngine'e güncellemeyi bildir
        await ruleEngine.reloadRules()
    },

    deleteRule: async (id) => {
        await db.rules.delete(id)

        set((state) => ({
            rules: state.rules.filter((r) => r.id !== id),
        }))

        await ruleEngine.reloadRules()
    },

    toggleRule: async (id) => {
        const rule = get().getRuleById(id)
        if (!rule) return

        await get().updateRule(id, { enabled: !rule.enabled })
    },

    duplicateRule: async (id) => {
        const rule = get().getRuleById(id)
        if (!rule) throw new Error('Kural bulunamadı')

        return await get().createRule({
            name: `${rule.name} (Kopya)`,
            trigger: rule.trigger,
            conditions: [...rule.conditions],
            actions: [...rule.actions],
            enabled: false,
        })
    },

    getRuleById: (id) => {
        return get().rules.find((r) => r.id === id)
    },

    getActiveRules: () => {
        return get().rules.filter((r) => r.enabled)
    },

    getRulesByTrigger: (trigger) => {
        return get().rules.filter((r) => r.trigger === trigger)
    },
}))
