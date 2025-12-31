import { Activities } from '@/modules/core-time/pages/Activities'
import { Dashboard } from '@/modules/dashboard/pages/Dashboard'
import { Habits } from '@/modules/habits/pages/Habits'
import { Settings } from '@/modules/settings/pages/Settings'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { ThemeProvider } from './providers/ThemeProvider'

// Lazy load heavy pages
const LazyCalendar = lazy(() => import('@/modules/calendar/pages/Calendar').then(m => ({ default: m.Calendar })))
const LazyStatistics = lazy(() => import('@/modules/insights/pages/Statistics').then(m => ({ default: m.Statistics })))

function LoadingFallback() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div>
        </div>
    )
}

export function App() {
    return (
        <ThemeProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<AppLayout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="calendar" element={<Suspense fallback={<LoadingFallback />}><LazyCalendar /></Suspense>} />
                        <Route path="statistics" element={<Suspense fallback={<LoadingFallback />}><LazyStatistics /></Suspense>} />
                        <Route path="activities" element={<Activities />} />
                        <Route path="habits" element={<Habits />} />
                        <Route path="settings" element={<Settings />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </ThemeProvider>
    )
}
