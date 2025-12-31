import { DateTime, Settings } from 'luxon'

// Configure Luxon defaults
Settings.defaultLocale = 'tr'

/**
 * Calculate effective date considering rollover hour
 * If current time is before rollover hour, it belongs to previous day
 */
export function getEffectiveDate(date: DateTime, rolloverHour: number): DateTime {
    if (date.hour < rolloverHour) {
        return date.minus({ days: 1 })
    }
    return date
}

/**
 * Get dateKey in YYYY-MM-DD format for the effective date
 */
export function getDateKey(date: DateTime, rolloverHour: number): string {
    const effectiveDate = getEffectiveDate(date, rolloverHour)
    return effectiveDate.toFormat('yyyy-MM-dd')
}

/**
 * Get today's dateKey
 */
export function getTodayKey(rolloverHour: number): string {
    return getDateKey(DateTime.now(), rolloverHour)
}

/**
 * Parse dateKey back to DateTime (start of day)
 */
export function parseDateKey(dateKey: string): DateTime {
    return DateTime.fromFormat(dateKey, 'yyyy-MM-dd').startOf('day')
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
        return `${hours}s ${minutes}dk`
    }
    if (minutes > 0) {
        return `${minutes}dk ${secs}sn`
    }
    return `${secs}sn`
}

/**
 * Format duration for timer display (HH:MM:SS)
 */
export function formatTimerDisplay(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    const pad = (n: number) => n.toString().padStart(2, '0')

    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
    }
    return `${pad(minutes)}:${pad(secs)}`
}

/**
 * Get week boundaries based on week start setting
 */
export function getWeekBoundaries(
    date: DateTime,
    weekStart: 1 | 7 // 1 = Monday, 7 = Sunday
): { start: DateTime; end: DateTime } {
    const weekday = date.weekday // 1 = Monday, 7 = Sunday

    let daysToSubtract: number
    if (weekStart === 1) {
        // Week starts on Monday
        daysToSubtract = weekday - 1
    } else {
        // Week starts on Sunday
        daysToSubtract = weekday === 7 ? 0 : weekday
    }

    const start = date.minus({ days: daysToSubtract }).startOf('day')
    const end = start.plus({ days: 6 }).endOf('day')

    return { start, end }
}

/**
 * Get all dates in a range
 */
export function getDateRange(start: DateTime, end: DateTime): DateTime[] {
    const dates: DateTime[] = []
    let current = start.startOf('day')
    const endDate = end.startOf('day')

    while (current <= endDate) {
        dates.push(current)
        current = current.plus({ days: 1 })
    }

    return dates
}

// ============================================
// Rollover-aware utility functions
// ============================================

/**
 * Check if two dates are the same effective day (considering rollover)
 */
export function isSameEffectiveDay(
    date1: DateTime,
    date2: DateTime,
    rolloverHour: number
): boolean {
    return getDateKey(date1, rolloverHour) === getDateKey(date2, rolloverHour)
}

/**
 * Check if a date is today (considering rollover)
 */
export function isToday(date: DateTime, rolloverHour: number): boolean {
    return getDateKey(date, rolloverHour) === getTodayKey(rolloverHour)
}

/**
 * Check if a date is yesterday (considering rollover)
 */
export function isYesterday(date: DateTime, rolloverHour: number): boolean {
    const todayKey = getTodayKey(rolloverHour)
    const yesterdayKey = parseDateKey(todayKey).minus({ days: 1 }).toFormat('yyyy-MM-dd')
    return getDateKey(date, rolloverHour) === yesterdayKey
}

/**
 * Get the effective start of day timestamp (considering rollover)
 * E.g., if rolloverHour is 4, returns 04:00 of the effective date
 */
export function getEffectiveDayStart(date: DateTime, rolloverHour: number): DateTime {
    const effectiveDate = getEffectiveDate(date, rolloverHour)
    return effectiveDate.startOf('day').plus({ hours: rolloverHour })
}

/**
 * Get the effective end of day timestamp (considering rollover)
 * E.g., if rolloverHour is 4, returns 03:59:59 of the next calendar day
 */
export function getEffectiveDayEnd(date: DateTime, rolloverHour: number): DateTime {
    return getEffectiveDayStart(date, rolloverHour)
        .plus({ days: 1 })
        .minus({ seconds: 1 })
}

/**
 * Get a list of dateKeys for the last N days (considering rollover)
 */
export function getLastNDaysKeys(n: number, rolloverHour: number): string[] {
    const keys: string[] = []
    const today = DateTime.now()

    for (let i = 0; i < n; i++) {
        const date = today.minus({ days: i })
        keys.push(getDateKey(date, rolloverHour))
    }

    return keys
}

/**
 * Get dateKeys for the current week (considering rollover and week start)
 */
export function getCurrentWeekKeys(
    rolloverHour: number,
    weekStart: 1 | 7
): string[] {
    const today = DateTime.now()
    const effectiveDate = getEffectiveDate(today, rolloverHour)
    const { start, end } = getWeekBoundaries(effectiveDate, weekStart)

    const keys: string[] = []
    const dates = getDateRange(start, end)

    for (const date of dates) {
        keys.push(date.toFormat('yyyy-MM-dd'))
    }

    return keys
}

/**
 * Format relative date (Bugün, Dün, vs.)
 */
export function formatRelativeDate(dateKey: string, rolloverHour: number): string {
    const todayKey = getTodayKey(rolloverHour)
    const yesterdayKey = parseDateKey(todayKey).minus({ days: 1 }).toFormat('yyyy-MM-dd')

    if (dateKey === todayKey) {
        return 'Bugün'
    }
    if (dateKey === yesterdayKey) {
        return 'Dün'
    }

    const date = parseDateKey(dateKey)
    return date.toFormat('d MMMM yyyy')
}

