import { db } from '@/db'
import type { Activity, RunningTimer, TimeSession } from '@/db/types'
import { eventBus } from '@/events'
import { generateId } from '@/shared/utils'
import { getDateKey } from '@/shared/utils/date'
import { DateTime } from 'luxon'
import { create } from 'zustand'

interface TimerState {
    // Running timers
    runningTimers: RunningTimer[]

    // Current tick (for UI updates)
    currentTick: number

    // Loading state
    isLoading: boolean

    // Actions
    initialize: () => Promise<void>
    startTimer: (activityId: string, mode?: 'normal' | 'pomodoro') => Promise<string>
    stopTimer: (timerId: string, rolloverHour?: number) => Promise<TimeSession | null>
    pauseTimer: (timerId: string) => Promise<void>
    resumeTimer: (timerId: string) => Promise<void>
    discardTimer: (timerId: string) => Promise<void>
    tick: () => void

    // Selectors
    getTimerForActivity: (activityId: string) => RunningTimer | undefined
    getElapsedSeconds: (timer: RunningTimer) => number
}

export const useTimerStore = create<TimerState>((set, get) => ({
    runningTimers: [],
    currentTick: Date.now(),
    isLoading: true,

    initialize: async () => {
        try {
            const timers = await db.runningTimers.toArray()
            set({ runningTimers: timers, isLoading: false })
        } catch (error) {
            console.error('Failed to initialize timers:', error)
            set({ isLoading: false })
        }
    },

    startTimer: async (activityId, mode = 'normal') => {
        const id = generateId()
        const now = Date.now()

        const timer: RunningTimer = {
            id,
            activityId,
            startedAt: now,
            accumulatedSec: 0,
            mode,
            createdAt: now,
        }

        await db.runningTimers.add(timer)

        set((state) => ({
            runningTimers: [...state.runningTimers, timer],
        }))

        await eventBus.publish('TIMER_STARTED', {
            timerId: id,
            activityId,
            startedAt: now,
            mode,
        })

        return id
    },

    stopTimer: async (timerId, rolloverHour = 4) => {
        const timer = get().runningTimers.find((t) => t.id === timerId)
        if (!timer) return null

        const now = Date.now()
        const elapsedSeconds = get().getElapsedSeconds(timer)

        // Create session
        const sessionId = generateId()
        const dateKey = getDateKey(DateTime.now(), rolloverHour)

        const session: TimeSession = {
            id: sessionId,
            activityId: timer.activityId,
            startAt: timer.startedAt,
            endAt: now,
            durationSec: elapsedSeconds,
            note: '',
            dateKey,
            mergedFromIds: [],
            createdAt: now,
            updatedAt: now,
        }

        // Transaction: delete timer, add session
        await db.transaction('rw', [db.runningTimers, db.timeSessions], async () => {
            await db.runningTimers.delete(timerId)
            await db.timeSessions.add(session)
        })

        set((state) => ({
            runningTimers: state.runningTimers.filter((t) => t.id !== timerId),
        }))

        // Publish events
        await eventBus.publish('TIMER_STOPPED', {
            timerId,
            activityId: timer.activityId,
            durationSec: elapsedSeconds,
            sessionId,
        })

        await eventBus.publish('SESSION_CREATED', { session })

        return session
    },

    pauseTimer: async (timerId) => {
        const timer = get().runningTimers.find((t) => t.id === timerId)
        if (!timer || timer.pausedAt) return

        const now = Date.now()
        const elapsedSinceStart = Math.floor((now - timer.startedAt) / 1000)
        const newAccumulated = timer.accumulatedSec + elapsedSinceStart

        await db.runningTimers.update(timerId, {
            pausedAt: now,
            accumulatedSec: newAccumulated,
        })

        set((state) => ({
            runningTimers: state.runningTimers.map((t) =>
                t.id === timerId
                    ? { ...t, pausedAt: now, accumulatedSec: newAccumulated }
                    : t
            ),
        }))

        await eventBus.publish('TIMER_PAUSED', {
            timerId,
            activityId: timer.activityId,
            accumulatedSec: newAccumulated,
        })
    },

    resumeTimer: async (timerId) => {
        const timer = get().runningTimers.find((t) => t.id === timerId)
        if (!timer || !timer.pausedAt) return

        const now = Date.now()

        // Use modify to properly handle removing optional property
        await db.runningTimers.where('id').equals(timerId).modify((t) => {
            t.startedAt = now
            delete t.pausedAt
        })

        set((state) => ({
            runningTimers: state.runningTimers.map((t) => {
                if (t.id === timerId) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { pausedAt: _, ...rest } = t
                    return { ...rest, startedAt: now }
                }
                return t
            }),
        }))

        await eventBus.publish('TIMER_RESUMED', {
            timerId,
            activityId: timer.activityId,
        })
    },

    discardTimer: async (timerId) => {
        await db.runningTimers.delete(timerId)

        set((state) => ({
            runningTimers: state.runningTimers.filter((t) => t.id !== timerId),
        }))
    },

    tick: () => {
        set({ currentTick: Date.now() })
    },

    getTimerForActivity: (activityId) => {
        return get().runningTimers.find((t) => t.activityId === activityId)
    },

    /**
     * Drift-corrected elapsed time calculation
     * Bu fonksiyon sekme arka plana gitse bile doğru süreyi hesaplar
     * çünkü startedAt'tan bu yana geçen gerçek süreyi kullanır
     */
    getElapsedSeconds: (timer) => {
        if (timer.pausedAt) {
            return timer.accumulatedSec
        }

        // DRIFT CORRECTION: Her zaman Date.now() kullan, currentTick değil
        // Bu sayede tarayıcı sekmeyi uyutsa bile geri dönüldüğünde
        // süre doğru hesaplanır
        const now = Date.now()
        const elapsedSinceStart = Math.floor((now - timer.startedAt) / 1000)
        return timer.accumulatedSec + elapsedSinceStart
    },
}))

// Activities store
interface ActivitiesState {
    activities: Activity[]
    isLoading: boolean

    initialize: () => Promise<void>
    createActivity: (data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
    updateActivity: (id: string, data: Partial<Activity>) => Promise<void>
    archiveActivity: (id: string) => Promise<void>
    restoreActivity: (id: string) => Promise<void>
    deleteActivity: (id: string) => Promise<void>
}

export const useActivitiesStore = create<ActivitiesState>((set, get) => ({
    activities: [],
    isLoading: true,

    initialize: async () => {
        try {
            const activities = await db.activities.toArray()
            set({ activities, isLoading: false })
        } catch (error) {
            console.error('Failed to initialize activities:', error)
            set({ isLoading: false })
        }
    },

    createActivity: async (data) => {
        const id = generateId()
        const now = Date.now()

        const activity: Activity = {
            ...data,
            id,
            createdAt: now,
            updatedAt: now,
        }

        await db.activities.add(activity)

        set((state) => ({
            activities: [...state.activities, activity],
        }))

        return id
    },

    updateActivity: async (id, data) => {
        const now = Date.now()
        await db.activities.update(id, { ...data, updatedAt: now })

        set((state) => ({
            activities: state.activities.map((a) =>
                a.id === id ? { ...a, ...data, updatedAt: now } : a
            ),
        }))
    },

    archiveActivity: async (id) => {
        await get().updateActivity(id, { archived: true })
    },

    restoreActivity: async (id) => {
        await get().updateActivity(id, { archived: false })
    },

    deleteActivity: async (id) => {
        await db.activities.delete(id)

        set((state) => ({
            activities: state.activities.filter((a) => a.id !== id),
        }))
    },
}))
