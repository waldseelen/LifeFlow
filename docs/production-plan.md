# LifeFlow (Offline‑First PWA) — Production Plan (MVP → v1 → v2)

> Tarih: 2025-12-30
> Hedef: Tek kod tabanı ile **offline‑first PWA**. v1’de **sunucusuz** (hesap zorunlu değil). Senkron/Drive/Dropbox **opsiyonel modül**.
> v2: PWA kısıtlarını aşmak için **Capacitor wrapper** ile aynı web UI’ı “native yeteneklerle” genişletme.

---

## 1) Ürün Tanımı

LifeFlow; zaman takibi (STT benzeri) + alışkanlık takibi (uhabits benzeri) + hedefler/kurallar + içgörü/istatistik + veri kasası (export/import/şifreleme) özelliklerini **tek bir offline uygulamada** birleştirir.

### 1.1 İlkeler
- **Offline‑first**: Tüm çekirdek işlevler ağ olmadan çalışır.
- **Local‑only v1**: Server yok; veri cihazda (IndexedDB). Export/import ile taşınabilir.
- **Modüler sınırlar**: Core Time / Habits / Goals&Rules / Insights / Notify / Data Vault net ayrılır.
- **Event‑driven**: Kullanıcı aksiyonları “domain event” üretir; Insights/Rules/Notify bunları dinler.
- **Testli iterasyon**: Kritik algoritmalar unit test ile kilitlenir; kritik akışlar Playwright ile doğrulanır.

---

## 2) PWA Gerçekleri (Gerçekçi Scope)

### 2.1 PWA’da tam yapılır
- Çoklu timer, manuel kayıt, pomodoro (ön planda)
- Habits: günlük/haftalık/özel periyot, streak, skip
- İstatistikler: client‑side compute + grafikler
- Offline veri: IndexedDB
- JSON/CSV export‑import, opsiyonel yerel şifreleme (WebCrypto)
- Tema, i18n, arama/filtre/sıralama, undo/redo (uygulama içinde)

### 2.2 PWA’da kısmi / tarayıcıya bağlı
- Bildirimler: Notification izinleri, platform farkları
- Arka plan zamanlayıcı: tarayıcı uyku/kapalı senaryolarda kesilebilir
- “Widget benzeri”: gerçek widget yok; shortcut/quick action taklidi

### 2.3 Pratikte native ister (v2)
- Android/iOS gerçek widget
- Daha güvenilir local notifications
- Background tasks
- Dosya sistemi entegrasyonu

---

## 3) MVP → v1 → v2 Roadmap (Net Kesimler)

### 3.1 MVP (çıkarılmayacak çekirdek)
**Time**
- Tek/çoklu timer (ayar ile)
- Manuel time session ekleme
- Session edit/sil
- Merge (aynı activity, arası < N dk)
- Pomodoro (basic: 25/5; ön planda)

**Habits**
- Daily/weekly/custom periyot
- Check/skip/fail
- Streak (skip bozmaz)

**Insights**
- Toplam/ortalama metrikler
- 3 grafik: bar/line/pie
- GitHub‑grid heatmap (habit veya yoğunluk)

**Filters**
- Date range + category + tag

**Data Vault**
- JSON export/import (minimum)
- CSV export/import (minimum)

**Settings**
- Day rollover hour
- Week start
- Theme

### 3.2 v1 (ürün hissi)
- Goals: min/max hedefler, progress ring
- Rules: basit event→action (örn. “pomodoro bitti → bildirim”)
- Saved filter profilleri
- Notes arama
- Undo/redo (kritik işlemler)

### 3.3 v2 (PWA + Capacitor)
- Local notifications güvenilirliği, background
- Dosya sistemi entegrasyonu
- Drive/Dropbox cloud backup (opsiyonel modül)
- Android “widget benzeri” gerçek çözüm

---

## 4) Modül Kırılımı (Tek projede net sınırlar)

Her modül şu katmanları içerir:
- **UI**: pages/components
- **Application**: use‑case’ler (startTimer, stopTimer, toggleCheckmark…)
- **Domain**: entity + iş kuralları + algoritmalar
- **Data**: Dexie repository + migration
- **Infra**: SW, notifications, crypto, file export

### 4.1 Modüller
1) **Core Time**: activities, timers, sessions, pomodoro
2) **Habits**: definitions, schedules, checkmarks, streak/skip/strength
3) **Goals & Rules**: hedefler + kural motoru (event→condition→action)
4) **Insights**: aggregations + charts + saved filters
5) **Notify**: reminders + push/local (PWA kısıtlı)
6) **Data Vault**: backup/export/import + encryption + migrations

---

## 5) Tech Stack (PWA için pratik set)

### 5.1 Frontend
- React + TypeScript + Vite
- Router: React Router (veya TanStack Router — karar: routing ihtiyaçlarına göre)

### 5.2 UI
- TailwindCSS
- Headless UI veya Radix UI (tekini seçip standartlaştır)

### 5.3 State
- Zustand (global state + minimal boilerplate)
- Derived selectors ile performanslı hesaplama

### 5.4 DB & Migrations
- IndexedDB
- Dexie (index + migration kolaylığı)

### 5.5 Date/Time
- Luxon (timezone + week start + parsing)

### 5.6 Charts
- ECharts (esneklik) **veya** Chart.js (hafiflik)
- Heatmap grid: custom canvas veya lightweight grid renderer

### 5.7 PWA
- Workbox (precache + offline cache stratejileri)
- Web App Manifest + icons

### 5.8 Testing
- Unit: Vitest
- E2E: Playwright (kritik akışlar)

### 5.9 CI
- GitHub Actions: lint + typecheck + test + build

---

## 6) Mimari: Clean + Event‑Driven

### 6.1 Katmanlar
- **UI**: Presentational + minimal side‑effects
- **Application**: use‑case orchestration (transactional iş akışları)
- **Domain**: saf fonksiyonlar + entity invariants
- **Data**: repository pattern, Dexie transaction
- **Infra**: platform bağımlı işler (SW, notifications, crypto, export)

### 6.2 Event Bus (kritik)
Her “use‑case” bir veya daha fazla event üretir:
- `TIMER_STARTED`, `TIMER_STOPPED`
- `SESSION_CREATED`, `SESSION_UPDATED`, `SESSION_MERGED`, `SESSION_SPLIT`
- `HABIT_CHECKED`, `HABIT_SKIPPED`, `HABIT_FAILED`
- `DAY_ROLLOVER`
- `GOAL_REACHED`

Bu event’ler:
- Insights hesaplarını günceller (incremental cache)
- Rules motorunu tetikler
- Notifications planını günceller

**Kural**: UI event yaymaz; yalnızca Application layer event publish eder.

---

## 7) Veri Modeli (IndexedDB / Dexie)

> Not: v1’de “tek polimorfik Activity” yaklaşımı **opsiyon**. Başlangıç için (MVP hız) Activity + Habit + TimeSession ayrımı daha okunabilir olabilir.

### 7.1 Temel tablolar
- Category: `id, name, color, icon, archived`
- Tag: `id, name, color, groupId?`
- Activity: `id, name, categoryId, tagIds[], archived, defaultGoalIds[]`
- TimeSession: `id, activityId, startAt, endAt, durationSec, note, mergedFromIds[]`
- RunningTimer: `id, activityId, startedAt, pausedAt?, accumulatedSec, mode, configId?`
- Habit: `id, name, type, scheduleSpec, minTarget/maxTarget, unit, categoryId, tagIds[], allowSkip, strengthConfig`
- HabitLog: `id, habitId, dateKey, status, value?, note?`
- Goal: `id, scope, metric, min/max, target, activityId? habitId?`
- Rule: `id, trigger, conditionsJSON, actionsJSON, enabled`
- Reminder: `id, kind, schedule, channels, enabled`
- Setting: `key, value`

### 7.2 İndeksler (performans)
- TimeSession: `(activityId + startAt)`, `(startAt)`
- HabitLog: `(habitId + dateKey)`, `(dateKey)`
- Activity/Habit: `(categoryId)`, `(archived)`

---

## 8) Kritik Algoritmalar (MVP’de doğru çalışmalı)

### 8.1 Gün değişimi (rollover)
- Ayar: günün “bitme saati” `rolloverHour` (örn. 04:00)
- `effectiveDate = localTime - rolloverOffset`
- `dateKey = YYYY-MM-DD` bu `effectiveDate` üzerinden üretilir

### 8.2 Streak (skip bozmadan)
- `done`: streak artar
- `skip`: streak korunur ama başarı yüzdesinde ayrı sayılır
- `fail`/missing: streak kırar

### 8.3 Weekly hedef (örn. haftada 3x)
- `ScheduleSpec = { type:'weekly', required:3, allowedDays? }`
- Tamam: hafta aralığında `doneCount >= required`

### 8.4 Habit strength (uyarlanabilir formül)
Öneri:
- `strength = clamp(0..100, 0.6*streakScore + 0.3*consistency90d + 0.1*recency7d)`
- streakScore: log ölçek
- consistency90d: 90 günde done / planlanan gün
- recency7d: son 7 günde ağırlıklı done

### 8.5 Time merge/split
- Merge: aynı activity, arası < N dakika ise birleştir
- Split: session’ı iki TimeSession’a böl (notlar korunur)

---

## 9) UI/UX Yapısı (PWA)

### 9.1 Global Layout
- Desktop: Sidebar
- Mobile: Bottom Navigation
- Main Content
- FAB: “Hızlı Ekle” (habit veya time log)

### 9.2 Sayfalar
- **Dashboard**: running timers + habit today list + quick actions + mini pie + completion bar
- **Calendar**: History Log (heatmap + gün log listesi) / Timeline (00:00-23:59 blok düzenleme)
- **Statistics**: date range + filters; Time Analytics / Habit Analytics
- **Activities**: kategori bazlı yönetim + create/edit modal
- **Settings**: tema/dil, multitasking, pomodoro süreleri, export/import, automation rules

---

## 10) Repo Yapısı (öneri)

Tek uygulama (monorepo değil):
- `src/app/` (routing, layout, providers)
- `src/modules/` (core-time, habits, insights, goals-rules, notify, data-vault)
- `src/shared/` (ui primitives, utils, types)
- `src/db/` (dexie schema, migrations)
- `src/infra/` (crypto, export/import, notifications, service worker)
- `src/events/` (event bus, event types)
- `tests/` (unit)
- `e2e/` (playwright)

---

## 11) Kalite Kapıları (zorunlu)

Her PR için minimum:
- Typecheck: TS strict, `noImplicitAny`
- Unit test: rollover + streak + schedule + merge/split
- E2E:
  - Start timer → stop → session list’te görünür
  - Habit check → insights güncellenir
- DB değişikliği varsa: migration + repo update + minimal UI adapt

Performans kapısı:
- Insights hesapları “full recompute” yerine **incremental cache** (event sonrası delta update)

---

## 12) CI/CD (GitHub Actions)

Pipeline (her push/PR):
1) Install deps
2) Lint
3) Typecheck
4) Unit tests
5) Build
6) (opsiyon) Playwright smoke

Release (tag/branch):
- Build artifact
- Deploy: GitHub Pages / Cloudflare Pages / Netlify (statik hosting)

---

## 13) Veri Taşınabilirliği & Güvenlik

### 13.1 Export/Import
- JSON: tam yedek + metadata (schemaVersion)
- CSV: minimum ortak format
- ICS: time sessions için iCalendar export (v1 veya v1.1)

### 13.2 Şifreleme (opsiyonel)
- WebCrypto ile local encryption
- Anahtar yönetimi: kullanıcı passphrase (PBKDF2/Argon2 yoksa PBKDF2) + salt
- Şifreleme aç/kapat migration stratejisi net olmalı

---

## 14) “Vibe Coding” Çalışma Düzeni (Uzun-horizon)

### 14.1 Project Context Pack (tek seferlik)
- Ürün amacı + MVP scope
- PWA kısıtları
- Katmanlı mimari + event bus
- DB şeması + indeksler
- Kod standartları: TS strict, functional components, repository pattern
- “Her PR: test + migration + typecheck zorunlu”

### 14.2 Görev formatı
Input:
- hedef davranış
- kabul kriterleri
- ilgili modül + dosyalar

Output:
- dosya değişiklik listesi
- patch/diff
- test planı
- edge‑case listesi

### 14.3 Görev boyutu kuralı
- 1 görev = maksimum 1 modül + 1 UI flow
- DB değişikliği varsa aynı görevde: migration + repo update + minimal UI adapt

---

## 15) Riskler ve Ön Kararlar
- Widget/Wear OS ihtiyacı yükselirse: v2 Capacitor’a geçişi erkene çek
- Bildirim/arka plan beklentisini platform gerçeklerine göre scope’la
- Feature listesi büyürse modül sınırlarını delmeden ilerle (refactor maliyeti patlar)

---

## 16) Uygulanabilir Backlog (önerilen sıra)
1) Repo scaffold + routing + layout + theme
2) Dexie setup + migrations + repositories
3) Activity CRUD + Category/Tag CRUD
4) Timer engine (runningTimer store) + start/stop + session write
5) Sessions list + edit/merge/split
6) Habit engine (scheduleSpec parser) + today list
7) HabitLog + streak/skip + unit tests
8) Insights aggregations + cache + 3 chart
9) Export/import JSON + CSV basic (+ ICS opsiyon)
10) Goals + progress ring
11) Rules v1 (2 trigger, 3 action) + simulate panel
12) PWA SW (offline cache) + install prompt + icon set
wwwww
