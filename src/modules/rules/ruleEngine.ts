import { db } from '@/db'
import type { Rule } from '@/db/types'
import { eventBus } from '@/events'
import type { EventPayload, EventType } from '@/events/types'
import { getTodayKey } from '@/shared/utils/date'
import { executeActions } from './actionExecutor'
import { evaluateConditions } from './conditionEvaluator'
import type { EvaluatedRule, RuleContext } from './types'

// ============================================
// Rule Engine - Event Bus ile entegre otomasyon motoru
// ============================================

class RuleEngine {
    private isRunning = false
    private unsubscribers: Array<{ unsubscribe: () => void }> = []
    private rulesCache: Rule[] = []
    private rolloverHour = 4

    /**
     * RuleEngine'i başlat ve EventBus'ı dinlemeye başla
     */
    async start(rolloverHour = 4): Promise<void> {
        if (this.isRunning) {
            console.warn('[RuleEngine] Zaten çalışıyor')
            return
        }

        this.rolloverHour = rolloverHour
        await this.loadRules()
        this.subscribeToEvents()
        this.isRunning = true

        console.log('[RuleEngine] Başlatıldı, aktif kural sayısı:', this.rulesCache.length)
    }

    /**
     * RuleEngine'i durdur
     */
    stop(): void {
        this.unsubscribers.forEach((sub) => sub.unsubscribe())
        this.unsubscribers = []
        this.isRunning = false

        console.log('[RuleEngine] Durduruldu')
    }

    /**
     * Kuralları veritabanından yükle
     */
    async loadRules(): Promise<void> {
        try {
            this.rulesCache = await db.rules.where('enabled').equals(1).toArray()
        } catch (error) {
            console.error('[RuleEngine] Kurallar yüklenemedi:', error)
            this.rulesCache = []
        }
    }

    /**
     * Kuralları yeniden yükle (kural ekleme/silme sonrası çağrılır)
     */
    async reloadRules(): Promise<void> {
        await this.loadRules()
        console.log('[RuleEngine] Kurallar yeniden yüklendi:', this.rulesCache.length)
    }

    /**
     * EventBus'taki tüm ilgili event'lere abone ol
     */
    private subscribeToEvents(): void {
        const eventTypes: EventType[] = [
            'TIMER_STARTED',
            'TIMER_STOPPED',
            'SESSION_CREATED',
            'HABIT_CHECKED',
            'POMODORO_COMPLETED',
            'GOAL_REACHED',
            'DAY_ROLLOVER',
        ]

        for (const eventType of eventTypes) {
            const subscription = eventBus.subscribe(eventType, async (payload) => {
                await this.handleEvent(eventType, payload)
            })
            this.unsubscribers.push(subscription)
        }
    }

    /**
     * Event geldiğinde eşleşen kuralları değerlendir ve çalıştır
     */
    private async handleEvent<T extends EventType>(
        eventType: T,
        payload: EventPayload<T>
    ): Promise<EvaluatedRule[]> {
        // Bu event türü için eşleşen kuralları bul
        const matchingRules = this.rulesCache.filter(
            (rule) => rule.trigger === eventType
        )

        if (matchingRules.length === 0) {
            return []
        }

        const results: EvaluatedRule[] = []
        const context = await this.buildContext(payload as Record<string, unknown>)

        for (const rule of matchingRules) {
            const result = await this.evaluateAndExecuteRule(rule, context)
            results.push(result)
        }

        return results
    }

    /**
     * Context nesnesini oluştur
     */
    private async buildContext(payload: Record<string, unknown>): Promise<RuleContext> {
        return {
            payload,
            getActivityById: async (id: string) => {
                return await db.activities.get(id)
            },
            getHabitById: async (id: string) => {
                return await db.habits.get(id)
            },
            getCurrentTime: () => Date.now(),
            getTodayKey: () => getTodayKey(this.rolloverHour),
        }
    }

    /**
     * Tek bir kuralı değerlendir ve koşullar sağlanıyorsa aksiyonları çalıştır
     */
    private async evaluateAndExecuteRule(
        rule: Rule,
        context: RuleContext
    ): Promise<EvaluatedRule> {
        const result: EvaluatedRule = {
            ruleId: rule.id,
            ruleName: rule.name,
            trigger: rule.trigger,
            matched: false,
            actionsExecuted: false,
        }

        try {
            // Koşulları değerlendir
            const conditionsMatch = evaluateConditions(rule.conditions, context)
            result.matched = conditionsMatch

            if (conditionsMatch) {
                // Aksiyonları çalıştır
                const actionResults = await executeActions(rule.actions, context)
                result.actionsExecuted = actionResults.every((r) => r.success)

                if (!result.actionsExecuted) {
                    const failedAction = actionResults.find((r) => !r.success)
                    if (failedAction?.error) {
                        result.error = failedAction.error
                    }
                }

                console.log('[RuleEngine] Kural çalıştırıldı:', {
                    ruleName: rule.name,
                    trigger: rule.trigger,
                    actionsExecuted: result.actionsExecuted,
                })
            }
        } catch (error) {
            result.error = String(error)
            console.error('[RuleEngine] Kural değerlendirme hatası:', error)
        }

        return result
    }

    /**
     * Bir kuralı manuel olarak test et (Simulate Panel için)
     */
    async testRule(
        rule: Rule,
        mockPayload: Record<string, unknown>
    ): Promise<EvaluatedRule> {
        const context = await this.buildContext(mockPayload)
        return this.evaluateAndExecuteRule(rule, context)
    }

    /**
     * Mevcut durum bilgisini al
     */
    getStatus(): { isRunning: boolean; ruleCount: number } {
        return {
            isRunning: this.isRunning,
            ruleCount: this.rulesCache.length,
        }
    }
}

// Singleton instance
export const ruleEngine = new RuleEngine()
