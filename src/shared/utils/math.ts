/**
 * uhabits Style Habit Scoring Algorithm
 *
 * Bu modül uhabits'in ünlü "Exponential Smoothing" algoritmasını TypeScript'e port eder.
 * Kaynak: https://github.com/iSoron/uhabits/blob/dev/uhabits-core/src/jvmMain/kotlin/org/isoron/uhabits/core/models/Score.kt
 *
 * Algoritma Özeti:
 * - Her gün için bir "value" (0.0 - 1.0) hesaplanır
 * - Yeni değer = α * (bugünkü durum) + (1 - α) * (dünkü değer)
 * - α (alpha) küçüldükçe alışkanlık daha "yavaş" güçlenir/zayıflar
 * - Bu, tutarlılığı ödüllendiren ve tek seferlik hataları affeden bir sistem oluşturur
 */

// ============================================
// Constants (uhabits defaults)
// ============================================

/**
 * Alpha değerleri - alışkanlığın ne kadar hızlı güçlendiğini/zayıfladığını belirler
 * Daha düşük alpha = daha yavaş değişim = daha kararlı alışkanlık
 */
export const SCORE_ALPHA_DAILY = 0.052 // Günlük alışkanlıklar için (19 günlük yarı ömür)
export const SCORE_ALPHA_WEEKLY = 0.02 // Haftalık alışkanlıklar için (~35 günlük yarı ömür)

/**
 * Yarı ömür (half-life) hesaplama:
 * halfLife = -ln(2) / ln(1 - alpha)
 *
 * alpha = 0.052 için halfLife ≈ 13 gün
 * alpha = 0.02 için halfLife ≈ 35 gün
 */

// ============================================
// Core Scoring Functions
// ============================================

export interface HabitCheckValue {
    /** Tarih (YYYY-MM-DD formatında) */
    dateKey: string
    /** Tamamlandı mı? 0-1 arası (kısmi tamamlama destekler) */
    value: number
}

export interface ScoreResult {
    /** Güncel puan (0-100 arası) */
    currentScore: number
    /** Trend: pozitif = yükseliyor, negatif = düşüyor */
    trend: number
    /** Son 7 günlük ortalama */
    weeklyAverage: number
    /** Son 30 günlük ortalama */
    monthlyAverage: number
    /** Ham skor değeri (0-1) */
    rawScore: number
}

/**
 * Exponential Smoothing ile alışkanlık puanını hesapla
 *
 * @param checks - Tarih sıralı check listesi (eskiden yeniye)
 * @param alpha - Smoothing faktörü (varsayılan: günlük için)
 * @returns Son hesaplanan puan (0-1)
 */
export function calculateExponentialScore(
    checks: HabitCheckValue[],
    alpha: number = SCORE_ALPHA_DAILY
): number {
    let score = 0

    for (const check of checks) {
        // Yeni skor = α * (bugünkü değer) + (1 - α) * (eski skor)
        score = alpha * check.value + (1 - alpha) * score
    }

    return score
}

/**
 * Tam kapsamlı alışkanlık puanlama sonucu hesapla
 *
 * @param checks - Tarih sıralı check listesi
 * @param alpha - Smoothing faktörü
 * @returns ScoreResult objesi
 */
export function calculateHabitScore(
    checks: HabitCheckValue[],
    alpha: number = SCORE_ALPHA_DAILY
): ScoreResult {
    const rawScore = calculateExponentialScore(checks, alpha)

    // Son 7 ve 30 günlük ortalamaları hesapla
    const last7Days = checks.slice(-7)
    const last30Days = checks.slice(-30)

    const weeklyAverage = last7Days.length > 0
        ? last7Days.reduce((sum, c) => sum + c.value, 0) / last7Days.length
        : 0

    const monthlyAverage = last30Days.length > 0
        ? last30Days.reduce((sum, c) => sum + c.value, 0) / last30Days.length
        : 0

    // Trend hesapla (son 7 gün vs önceki 7 gün)
    const previous7Days = checks.slice(-14, -7)
    const previousWeekAvg = previous7Days.length > 0
        ? previous7Days.reduce((sum, c) => sum + c.value, 0) / previous7Days.length
        : 0
    const trend = weeklyAverage - previousWeekAvg

    return {
        currentScore: Math.round(rawScore * 100),
        trend: Math.round(trend * 100),
        weeklyAverage: Math.round(weeklyAverage * 100),
        monthlyAverage: Math.round(monthlyAverage * 100),
        rawScore,
    }
}

// ============================================
// Strength Calculation (production-plan.md'deki formül)
// ============================================

export interface StrengthConfig {
    /** Streak ağırlığı (varsayılan: 0.6) */
    streakWeight: number
    /** 90 günlük tutarlılık ağırlığı (varsayılan: 0.3) */
    consistencyWeight: number
    /** Son 7 günlük yakınlık ağırlığı (varsayılan: 0.1) */
    recencyWeight: number
}

export const DEFAULT_STRENGTH_CONFIG: StrengthConfig = {
    streakWeight: 0.6,
    consistencyWeight: 0.3,
    recencyWeight: 0.1,
}

/**
 * Streak skorunu logaritmik ölçekte hesapla (0-100)
 * Streak arttıkça artış yavaşlar (diminishing returns)
 */
export function calculateStreakScore(currentStreak: number, maxStreak: number = 100): number {
    if (currentStreak <= 0) return 0

    // Logaritmik ölçek: 100'e yaklaştıkça yavaşlar
    const logScore = Math.log10(currentStreak + 1) / Math.log10(maxStreak + 1)
    return Math.min(100, Math.round(logScore * 100))
}

/**
 * Son 90 günlük tutarlılık yüzdesini hesapla
 */
export function calculateConsistency90d(
    checks: HabitCheckValue[],
    plannedDays: number
): number {
    if (plannedDays <= 0) return 0

    const last90Days = checks.slice(-90)
    const doneDays = last90Days.filter((c) => c.value >= 0.5).length

    return Math.round((doneDays / Math.min(plannedDays, 90)) * 100)
}

/**
 * Son 7 günlük yakınlık skorunu hesapla (recency)
 * Daha yakın günler daha yüksek ağırlık alır
 */
export function calculateRecencyScore(checks: HabitCheckValue[]): number {
    const last7Days = checks.slice(-7)
    if (last7Days.length === 0) return 0

    // Ağırlıklı ortalama: son gün en yüksek ağırlığa sahip
    const weights = [1, 2, 3, 4, 5, 6, 7] // Son gün = 7
    let weightedSum = 0
    let totalWeight = 0

    last7Days.forEach((check, index) => {
        const weight = weights[index] || 1
        weightedSum += check.value * weight
        totalWeight += weight
    })

    return Math.round((weightedSum / totalWeight) * 100)
}

/**
 * Birleşik alışkanlık gücünü hesapla
 *
 * Formül: strength = 0.6*streakScore + 0.3*consistency90d + 0.1*recency7d
 */
export function calculateHabitStrength(
    currentStreak: number,
    checks: HabitCheckValue[],
    plannedDays: number,
    config: StrengthConfig = DEFAULT_STRENGTH_CONFIG
): number {
    const streakScore = calculateStreakScore(currentStreak)
    const consistencyScore = calculateConsistency90d(checks, plannedDays)
    const recencyScore = calculateRecencyScore(checks)

    const strength =
        config.streakWeight * streakScore +
        config.consistencyWeight * consistencyScore +
        config.recencyWeight * recencyScore

    return Math.min(100, Math.max(0, Math.round(strength)))
}

// ============================================
// Utility Functions
// ============================================

/**
 * HabitLog'ları check value listesine dönüştür
 */
export function logsToCheckValues(
    logs: Array<{ dateKey: string; status: 'done' | 'skip' | 'fail'; value?: number }>
): HabitCheckValue[] {
    return logs
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
        .map((log) => ({
            dateKey: log.dateKey,
            value: log.status === 'done' ? (log.value !== undefined ? log.value : 1) : 0,
        }))
}

/**
 * Belirli bir tarih aralığı için eksik günleri doldur
 */
export function fillMissingDays(
    checks: HabitCheckValue[],
    startDateKey: string,
    endDateKey: string
): HabitCheckValue[] {
    const result: HabitCheckValue[] = []
    const existingDates = new Set(checks.map((c) => c.dateKey))

    // Tarihleri parse et
    const start = new Date(startDateKey)
    const end = new Date(endDateKey)

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateKeyPart = d.toISOString().split('T')[0]
        if (!dateKeyPart) continue

        const dateKey = dateKeyPart
        const existing = checks.find((c) => c.dateKey === dateKey)

        if (existing) {
            result.push(existing)
        } else if (!existingDates.has(dateKey)) {
            result.push({ dateKey, value: 0 })
        }
    }

    return result
}

/**
 * Skor rengini belirle (görselleştirme için)
 */
export function getScoreColor(score: number): string {
    if (score >= 80) return '#22c55e' // green-500
    if (score >= 60) return '#84cc16' // lime-500
    if (score >= 40) return '#eab308' // yellow-500
    if (score >= 20) return '#f97316' // orange-500
    return '#ef4444' // red-500
}

/**
 * Trend ikonunu belirle
 */
export function getTrendIcon(trend: number): '↑' | '↓' | '→' {
    if (trend > 5) return '↑'
    if (trend < -5) return '↓'
    return '→'
}
