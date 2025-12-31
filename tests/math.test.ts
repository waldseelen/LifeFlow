import { describe, expect, it } from 'vitest'
import {
    calculateConsistency90d,
    calculateExponentialScore,
    calculateHabitScore,
    calculateHabitStrength,
    calculateRecencyScore,
    calculateStreakScore,
    fillMissingDays,
    getScoreColor,
    getTrendIcon,
    logsToCheckValues,
    SCORE_ALPHA_DAILY,
    type HabitCheckValue,
} from '../src/shared/utils/math'

describe('Exponential Smoothing Score', () => {
    it('boş check listesi için 0 döndürmeli', () => {
        const score = calculateExponentialScore([])
        expect(score).toBe(0)
    })

    it('tek bir done check için doğru skor hesaplamalı', () => {
        const checks: HabitCheckValue[] = [
            { dateKey: '2025-01-01', value: 1 },
        ]
        const score = calculateExponentialScore(checks, SCORE_ALPHA_DAILY)
        expect(score).toBeCloseTo(SCORE_ALPHA_DAILY, 5)
    })

    it('ardışık done checkler için skor artmalı', () => {
        const checks: HabitCheckValue[] = [
            { dateKey: '2025-01-01', value: 1 },
            { dateKey: '2025-01-02', value: 1 },
            { dateKey: '2025-01-03', value: 1 },
        ]
        const score = calculateExponentialScore(checks, SCORE_ALPHA_DAILY)
        expect(score).toBeGreaterThan(SCORE_ALPHA_DAILY * 2)
    })

    it('tüm done checkler için skor 1\'e yaklaşmalı', () => {
        // 90 ardışık done
        const checks: HabitCheckValue[] = Array.from({ length: 90 }, (_, i) => ({
            dateKey: `2025-01-${String(i + 1).padStart(2, '0')}`,
            value: 1,
        }))
        const score = calculateExponentialScore(checks, SCORE_ALPHA_DAILY)
        expect(score).toBeGreaterThan(0.9)
    })

    it('miss sonrası skor düşmeli', () => {
        const checksWithStreak: HabitCheckValue[] = [
            { dateKey: '2025-01-01', value: 1 },
            { dateKey: '2025-01-02', value: 1 },
            { dateKey: '2025-01-03', value: 1 },
        ]
        const scoreBeforeMiss = calculateExponentialScore(checksWithStreak, SCORE_ALPHA_DAILY)

        const checksWithMiss = [
            ...checksWithStreak,
            { dateKey: '2025-01-04', value: 0 },
        ]
        const scoreAfterMiss = calculateExponentialScore(checksWithMiss, SCORE_ALPHA_DAILY)

        expect(scoreAfterMiss).toBeLessThan(scoreBeforeMiss)
    })
})

describe('calculateHabitScore', () => {
    it('tam sonuç objesi döndürmeli', () => {
        const checks: HabitCheckValue[] = [
            { dateKey: '2025-01-01', value: 1 },
            { dateKey: '2025-01-02', value: 1 },
            { dateKey: '2025-01-03', value: 0 },
            { dateKey: '2025-01-04', value: 1 },
        ]
        const result = calculateHabitScore(checks)

        expect(result).toHaveProperty('currentScore')
        expect(result).toHaveProperty('trend')
        expect(result).toHaveProperty('weeklyAverage')
        expect(result).toHaveProperty('monthlyAverage')
        expect(result).toHaveProperty('rawScore')

        expect(result.currentScore).toBeGreaterThanOrEqual(0)
        expect(result.currentScore).toBeLessThanOrEqual(100)
    })
})

describe('calculateStreakScore', () => {
    it('0 streak için 0 döndürmeli', () => {
        expect(calculateStreakScore(0)).toBe(0)
    })

    it('streak arttıkça skor artmalı', () => {
        const score1 = calculateStreakScore(1)
        const score10 = calculateStreakScore(10)
        const score50 = calculateStreakScore(50)

        expect(score10).toBeGreaterThan(score1)
        expect(score50).toBeGreaterThan(score10)
    })

    it('logaritmik ölçek kullanmalı (diminishing returns)', () => {
        const diff1to10 = calculateStreakScore(10) - calculateStreakScore(1)
        const diff10to20 = calculateStreakScore(20) - calculateStreakScore(10)

        // İlk 10 günün artışı, 10-20 arasından daha büyük olmalı
        expect(diff1to10).toBeGreaterThan(diff10to20)
    })
})

describe('calculateConsistency90d', () => {
    it('boş liste için 0 döndürmeli', () => {
        expect(calculateConsistency90d([], 90)).toBe(0)
    })

    it('%100 tutarlılık hesaplamalı', () => {
        const checks: HabitCheckValue[] = Array.from({ length: 90 }, (_, i) => ({
            dateKey: `2025-01-${String(i + 1).padStart(2, '0')}`,
            value: 1,
        }))
        expect(calculateConsistency90d(checks, 90)).toBe(100)
    })

    it('%50 tutarlılık hesaplamalı', () => {
        const checks: HabitCheckValue[] = Array.from({ length: 45 }, (_, i) => ({
            dateKey: `2025-01-${String(i + 1).padStart(2, '0')}`,
            value: 1,
        }))
        expect(calculateConsistency90d(checks, 90)).toBe(50)
    })
})

describe('calculateRecencyScore', () => {
    it('boş liste için 0 döndürmeli', () => {
        expect(calculateRecencyScore([])).toBe(0)
    })

    it('tüm son 7 gün done için yüksek skor', () => {
        const checks: HabitCheckValue[] = Array.from({ length: 7 }, (_, i) => ({
            dateKey: `2025-01-${String(i + 1).padStart(2, '0')}`,
            value: 1,
        }))
        expect(calculateRecencyScore(checks)).toBe(100)
    })

    it('son günler daha ağırlıklı olmalı', () => {
        // İlk 3 gün done, son 4 gün miss
        const checksEarlyDone: HabitCheckValue[] = [
            { dateKey: '2025-01-01', value: 1 },
            { dateKey: '2025-01-02', value: 1 },
            { dateKey: '2025-01-03', value: 1 },
            { dateKey: '2025-01-04', value: 0 },
            { dateKey: '2025-01-05', value: 0 },
            { dateKey: '2025-01-06', value: 0 },
            { dateKey: '2025-01-07', value: 0 },
        ]

        // İlk 4 gün miss, son 3 gün done
        const checksLateDone: HabitCheckValue[] = [
            { dateKey: '2025-01-01', value: 0 },
            { dateKey: '2025-01-02', value: 0 },
            { dateKey: '2025-01-03', value: 0 },
            { dateKey: '2025-01-04', value: 0 },
            { dateKey: '2025-01-05', value: 1 },
            { dateKey: '2025-01-06', value: 1 },
            { dateKey: '2025-01-07', value: 1 },
        ]

        const earlyScore = calculateRecencyScore(checksEarlyDone)
        const lateScore = calculateRecencyScore(checksLateDone)

        // Son günlerdeki done daha değerli olmalı
        expect(lateScore).toBeGreaterThan(earlyScore)
    })
})

describe('calculateHabitStrength', () => {
    it('tüm bileşenlerden güç hesaplamalı', () => {
        const checks: HabitCheckValue[] = Array.from({ length: 30 }, (_, i) => ({
            dateKey: `2025-01-${String(i + 1).padStart(2, '0')}`,
            value: 1,
        }))
        const strength = calculateHabitStrength(30, checks, 30)

        expect(strength).toBeGreaterThan(0)
        expect(strength).toBeLessThanOrEqual(100)
    })

    it('sıfır streak ve check için düşük güç', () => {
        const strength = calculateHabitStrength(0, [], 0)
        expect(strength).toBe(0)
    })
})

describe('logsToCheckValues', () => {
    it('logları check değerlerine dönüştürmeli', () => {
        const logs = [
            { dateKey: '2025-01-02', status: 'done' as const },
            { dateKey: '2025-01-01', status: 'fail' as const },
            { dateKey: '2025-01-03', status: 'skip' as const },
        ]

        const checks = logsToCheckValues(logs)

        expect(checks).toHaveLength(3)
        // Tarih sıralı olmalı
        expect(checks[0].dateKey).toBe('2025-01-01')
        expect(checks[1].dateKey).toBe('2025-01-02')
        expect(checks[2].dateKey).toBe('2025-01-03')

        // Değerler doğru olmalı
        expect(checks[0].value).toBe(0) // fail
        expect(checks[1].value).toBe(1) // done
        expect(checks[2].value).toBe(0) // skip
    })

    it('numeric value\'ları korumalı', () => {
        const logs = [
            { dateKey: '2025-01-01', status: 'done' as const, value: 0.5 },
        ]

        const checks = logsToCheckValues(logs)
        expect(checks[0].value).toBe(0.5)
    })
})

describe('fillMissingDays', () => {
    it('eksik günleri 0 ile doldurmalı', () => {
        const checks: HabitCheckValue[] = [
            { dateKey: '2025-01-01', value: 1 },
            { dateKey: '2025-01-03', value: 1 },
        ]

        const filled = fillMissingDays(checks, '2025-01-01', '2025-01-03')

        expect(filled).toHaveLength(3)
        expect(filled[0]).toEqual({ dateKey: '2025-01-01', value: 1 })
        expect(filled[1]).toEqual({ dateKey: '2025-01-02', value: 0 })
        expect(filled[2]).toEqual({ dateKey: '2025-01-03', value: 1 })
    })
})

describe('getScoreColor', () => {
    it('yüksek skor için yeşil döndürmeli', () => {
        expect(getScoreColor(85)).toBe('#22c55e')
    })

    it('düşük skor için kırmızı döndürmeli', () => {
        expect(getScoreColor(15)).toBe('#ef4444')
    })
})

describe('getTrendIcon', () => {
    it('pozitif trend için yukarı ok', () => {
        expect(getTrendIcon(10)).toBe('↑')
    })

    it('negatif trend için aşağı ok', () => {
        expect(getTrendIcon(-10)).toBe('↓')
    })

    it('nötr trend için sağ ok', () => {
        expect(getTrendIcon(0)).toBe('→')
        expect(getTrendIcon(3)).toBe('→')
        expect(getTrendIcon(-3)).toBe('→')
    })
})
