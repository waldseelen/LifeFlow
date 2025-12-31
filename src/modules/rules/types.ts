import type { RuleAction, RuleActionConfig, RuleCondition, RuleTrigger } from '@/db/types'

// ============================================
// Rule Evaluation Types
// ============================================

export interface RuleContext {
    // Event payload
    payload: Record<string, unknown>

    // Current state helpers
    getActivityById: (id: string) => Promise<unknown>
    getHabitById: (id: string) => Promise<unknown>
    getCurrentTime: () => number
    getTodayKey: () => string
}

export interface EvaluatedRule {
    ruleId: string
    ruleName: string
    trigger: RuleTrigger
    matched: boolean
    actionsExecuted: boolean
    error?: string
}

export interface ActionResult {
    actionType: RuleAction
    success: boolean
    error?: string
    data?: unknown
}

// ============================================
// Condition Evaluator Types
// ============================================

export interface ConditionEvaluator {
    evaluate: (condition: RuleCondition, context: RuleContext) => boolean
}

// ============================================
// Action Executor Types
// ============================================

export interface ActionExecutor {
    execute: (action: RuleActionConfig, context: RuleContext) => Promise<ActionResult>
}

// ============================================
// Built-in Rule Templates
// ============================================

export interface RuleTemplate {
    id: string
    name: string
    description: string
    trigger: RuleTrigger
    conditions: RuleCondition[]
    actions: RuleActionConfig[]
}

export const RULE_TEMPLATES: RuleTemplate[] = [
    {
        id: 'pomodoro-notify',
        name: 'Pomodoro Tamamlandı Bildirimi',
        description: 'Pomodoro seansı bittiğinde bildirim gönder',
        trigger: 'POMODORO_COMPLETED',
        conditions: [],
        actions: [
            {
                type: 'NOTIFY',
                params: {
                    title: 'Pomodoro Tamamlandı!',
                    body: 'Mola zamanı geldi.',
                },
            },
        ],
    },
    {
        id: 'session-to-habit',
        name: 'Süre Hedefine Ulaşınca Alışkanlık Tamamla',
        description: 'Belirli bir aktivitede yeterli süre çalışınca ilgili alışkanlığı tamamla',
        trigger: 'SESSION_CREATED',
        conditions: [
            {
                field: 'payload.session.durationSec',
                operator: 'gte',
                value: 1800, // 30 dakika
            },
        ],
        actions: [
            {
                type: 'LOG_MESSAGE',
                params: {
                    message: 'Hedef süreye ulaşıldı!',
                },
            },
        ],
    },
    {
        id: 'goal-reached-notify',
        name: 'Hedefe Ulaşınca Bildirim',
        description: 'Günlük/haftalık hedef tamamlandığında bildirim',
        trigger: 'GOAL_REACHED',
        conditions: [],
        actions: [
            {
                type: 'NOTIFY',
                params: {
                    title: 'Hedef Tamamlandı!',
                    body: 'Tebrikler, hedefinize ulaştınız.',
                },
            },
        ],
    },
]
