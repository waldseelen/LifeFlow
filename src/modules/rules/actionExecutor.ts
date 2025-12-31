import type { RuleActionConfig } from '@/db/types'
import type { ActionResult, RuleContext } from './types'

/**
 * Execute NOTIFY action - sends a browser notification
 */
async function executeNotify(
    params: Record<string, unknown>,
    _context: RuleContext
): Promise<ActionResult> {
    const title = (params.title as string) || 'LifeFlow Bildirimi'
    const body = (params.body as string) || ''

    try {
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification(title, { body, icon: '/icons/icon-192.png' })
                return { actionType: 'NOTIFY', success: true }
            } else if (Notification.permission !== 'denied') {
                const permission = await Notification.requestPermission()
                if (permission === 'granted') {
                    new Notification(title, { body, icon: '/icons/icon-192.png' })
                    return { actionType: 'NOTIFY', success: true }
                }
            }
        }
        return {
            actionType: 'NOTIFY',
            success: false,
            error: 'Bildirim izni verilmedi',
        }
    } catch (error) {
        return {
            actionType: 'NOTIFY',
            success: false,
            error: String(error),
        }
    }
}

/**
 * Execute LOG_MESSAGE action - logs to console (can be extended)
 */
async function executeLogMessage(
    params: Record<string, unknown>,
    _context: RuleContext
): Promise<ActionResult> {
    const message = params.message as string
    console.log('[RuleEngine]', message, _context.payload)

    return {
        actionType: 'LOG_MESSAGE',
        success: true,
        data: { message },
    }
}

/**
 * Execute START_TIMER action - starts a timer for an activity
 * Note: This requires importing timerStore, which creates circular dependency
 * So we use dynamic import
 */
async function executeStartTimer(
    params: Record<string, unknown>,
    _context: RuleContext
): Promise<ActionResult> {
    const activityId = params.activityId as string

    if (!activityId) {
        return {
            actionType: 'START_TIMER',
            success: false,
            error: 'activityId gerekli',
        }
    }

    try {
        // Dynamic import to avoid circular dependency
        const { useTimerStore } = await import('@/modules/core-time/store/timerStore')
        const timerId = await useTimerStore.getState().startTimer(activityId, 'normal')

        return {
            actionType: 'START_TIMER',
            success: true,
            data: { timerId },
        }
    } catch (error) {
        return {
            actionType: 'START_TIMER',
            success: false,
            error: String(error),
        }
    }
}

/**
 * Execute TRIGGER_BREAK action - signals a break should start
 */
async function executeTriggerBreak(
    params: Record<string, unknown>,
    _context: RuleContext
): Promise<ActionResult> {
    const duration = (params.duration as number) || 5 * 60 // Default 5 min
    const isLongBreak = (params.isLongBreak as boolean) || false

    // This would typically emit an event or call pomodoro store
    console.log('[RuleEngine] Triggering break:', { duration, isLongBreak })

    return {
        actionType: 'TRIGGER_BREAK',
        success: true,
        data: { duration, isLongBreak },
    }
}

/**
 * Main action executor - routes to specific action handlers
 */
export async function executeAction(
    action: RuleActionConfig,
    context: RuleContext
): Promise<ActionResult> {
    const { type, params } = action

    switch (type) {
        case 'NOTIFY':
            return executeNotify(params, context)

        case 'LOG_MESSAGE':
            return executeLogMessage(params, context)

        case 'START_TIMER':
            return executeStartTimer(params, context)

        case 'TRIGGER_BREAK':
            return executeTriggerBreak(params, context)

        default:
            return {
                actionType: type,
                success: false,
                error: `Bilinmeyen aksiyon türü: ${type}`,
            }
    }
}

/**
 * Execute multiple actions in sequence
 */
export async function executeActions(
    actions: RuleActionConfig[],
    context: RuleContext
): Promise<ActionResult[]> {
    const results: ActionResult[] = []

    for (const action of actions) {
        const result = await executeAction(action, context)
        results.push(result)

        // Stop on first failure (optional - could be configurable)
        if (!result.success) {
            console.warn('[RuleEngine] Action failed, stopping execution:', result)
            break
        }
    }

    return results
}
