import { expect, test, type Page, type Request } from '@playwright/test'

const citizen = { id: 'citizen-1', fullName: 'Test Citizen', email: 'citizen@example.test', phoneNumber: '+15550000001', role: 'citizen' as const, accountStatus: 'active' as const, createdAt: '2026-01-01T00:00:00.000Z' }
const admin = { id: 'admin-1', fullName: 'Test Administrator', email: 'admin@example.test', phoneNumber: '+15550000002', role: 'admin' as const, accountStatus: 'active' as const, createdAt: '2026-01-01T00:00:00.000Z' }
const department = { _id: 'department-1', id: 'department-1', name: 'General Medicine', description: 'Primary care', isActive: true, available: true }

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
})

test('citizen completes booking, tracking, appointments, profile, documents, refresh, and logout', async ({ page }) => {
  const errors = watchBrowserErrors(page)
  const state = await installApiMock(page)
  await signIn(page, 'citizen@example.test')
  await expect(page.getByRole('heading', { name: /Welcome, Test/i })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: /Welcome, Test/i })).toBeVisible()

  await page.getByRole('link', { name: 'Book a New Token' }).click()
  await page.getByRole('button', { name: /City General Hospital/ }).click()
  await page.getByRole('button', { name: 'General Medicine' }).click()
  await page.getByRole('button', { name: /New Consultation/ }).click()
  await page.locator('#visit-date').fill(tomorrow())
  await page.getByRole('button', { name: '10:30 AM' }).click()
  await page.getByLabel('Government ID').check()
  await page.getByRole('button', { name: /Confirm & generate token/ }).click()
  await expect(page.getByRole('heading', { name: 'Your token has been booked' })).toBeVisible()
  expect(state.booking?.preferredVisitDate).toBe(tomorrow())
  expect(state.booking?.preferredTime).toBe('10:30')
  expect(state.booking?.visitType).toBe('New Consultation')

  await page.getByRole('link', { name: 'Track My Queue' }).click()
  await expect(page.getByRole('heading', { name: 'Track Your Queue' })).toBeVisible()
  await expect(page.getByText('Live API data')).toBeVisible()
  await page.getByRole('link', { name: 'My Appointments' }).first().click()
  await expect(page.getByRole('heading', { name: 'My Appointments' })).toBeVisible()
  await page.getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit profile' }).click()
  await page.getByLabel('Full name').fill('Updated Test Citizen')
  await page.getByLabel('Phone number').fill('+15550000003')
  await page.getByLabel('Date of birth').fill('1990-01-01')
  await page.getByLabel('Street address').fill('1 Test Street')
  await page.getByLabel('City').fill('Test City')
  await page.getByLabel('State').fill('Test State')
  await page.getByLabel('PIN code').fill('123456')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Profile changes saved to your account.')).toBeVisible()
  expect(state.profile.fullName).toBe('Updated Test Citizen')
  expect(state.profile.phoneNumber).toBe('+15550000003')
  await page.getByRole('link', { name: 'Documents', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Document checklist' })).toBeVisible()
  await expect(page.getByText(/Files stay in this browser session only/)).toBeVisible()
  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(errors).toEqual([])
})

test('citizen dashboard renders when API records and the authenticated name are missing optional fields', async ({ page }) => {
  const errors = watchBrowserErrors(page)
  await installApiMock(page)
  const citizenWithoutName = { ...citizen, fullName: '' }
  await page.route('**/api/auth/login', (route) => route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify({ status: 'success', data: { user: citizenWithoutName, accessToken: 'citizen-test-token', expiresIn: 900 } }) }))
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify({ status: 'success', data: { user: citizenWithoutName } }) }))
  await page.route('**/api/tokens/my**', (route) => route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify({ status: 'success', data: { items: [{ id: 'token-missing-department', tokenNumber: 'A102', status: 'waiting', estimatedWaitingTime: 12 }], pagination: { page: 1, limit: 50, total: 1, pages: 1 } } }) }))
  await page.route('**/api/appointments/my**', (route) => route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify({ status: 'success', data: { items: [{ id: 'appointment-missing-department', appointmentId: 'AP-102', appointmentDate: '2026-12-15', appointmentTime: '10:00', status: 'pending' }], pagination: { page: 1, limit: 50, total: 1, pages: 1 } } }) }))
  await signIn(page, 'citizen@example.test')
  await expect(page.getByRole('heading', { name: 'Welcome, there' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Current queue' })).toBeVisible()
  await expect(page.getByText('Department unavailable').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('admin operates counters, queue, tokens, appointments, reports, insights, preferences, and logout', async ({ page }) => {
  const errors = watchBrowserErrors(page)
  const state = await installApiMock(page)
  await signIn(page, 'admin@example.test')
  await expect(page.getByText('Welcome, Test.')).toBeVisible()
  await page.getByRole('link', { name: 'Counter Management' }).click()
  await expect(page.getByRole('heading', { name: 'Counter Management' })).toBeVisible()
  await page.getByRole('button', { name: 'Add Counter' }).click()
  await page.getByLabel('Counter name').fill('Browser Test Counter')
  await page.getByRole('button', { name: 'Create counter' }).click()
  await expect(page.getByText('Counter saved successfully.')).toBeVisible()
  expect(state.counters).toHaveLength(1)
  const status = page.getByLabel('Change status for CTR-BROWSER')
  if (await status.count()) await status.selectOption('Inactive')
  else await page.locator('.counter-card-actions select').first().selectOption('Inactive')
  await expect(page.getByText(/status changed/i)).toBeVisible()
  expect(state.counters[0].status).toBe('inactive')

  await page.goto('/admin/queue-management')
  await page.getByRole('button', { name: 'Call Next Patient' }).click()
  await expect(page.getByText(/Token A101 was called/i)).toBeVisible()
  expect(state.tokens[0].status).toBe('serving')

  for (const [path, heading] of [
    ['/admin/token-management', 'Token Management'],
    ['/admin/appointments', 'Appointments'],
    ['/admin/reports', 'Reports & Analytics'],
    ['/admin/ai-insights', 'AI Insights'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: false }).first()).toBeVisible()
    if (path === '/admin/ai-insights') await expect(page.getByText(/Rule-based fallback/)).toBeVisible()
  }
  await page.goto('/admin/appointments')
  await page.getByRole('button', { name: 'Approve AP-TEST' }).click()
  await expect(page.getByText(/Appointment AP-TEST updated/i)).toBeVisible()
  expect(state.appointments[0].status).toBe('approved')
  await page.goto('/admin/settings')
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await page.getByLabel('Admin name').fill('Updated Test Administrator')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByText(/Admin profile updated/i)).toBeVisible()
  await page.getByLabel('Daily summary notifications').check()
  await page.locator('#notifications').getByRole('button', { name: 'Save preferences' }).click()
  await expect(page.getByText(/Notification preferences updated/i)).toBeVisible()
  expect(state.adminPreferences.dailySummary).toBe(true)
  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(errors).toEqual([])
})

test('route boundaries, empty/error states, and document metadata are visible in the browser', async ({ page }) => {
  const errors = watchBrowserErrors(page)
  await page.goto('/citizen/dashboard')
  await expect(page).toHaveURL(/\/login$/)
  const state = await installApiMock(page)
  await signIn(page, 'citizen@example.test')
  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL(/\/citizen\/dashboard$/)
  await page.goto('/citizen/documents')
  await expect(page.getByText(/metadata|temporary|browser session/i).first()).toBeVisible()
  expect(state).toBeDefined()
  await page.getByRole('button', { name: 'Logout' }).click()
  await signIn(page, 'admin@example.test')
  await page.goto('/citizen/dashboard')
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
  await page.route('**/api/admin/counters**', (route) => route.fulfill({ status: 503, headers: corsHeaders, body: JSON.stringify({ status: 'error', message: 'Service unavailable.' }) }))
  await page.goto('/admin/counter-management')
  await expect(page.getByRole('alert')).toContainText('Service unavailable')
  expect(errors.some((error) => error.includes('503'))).toBe(true)
  expect(errors.filter((error) => !error.includes('503'))).toEqual([])
})

type MockState = { booking: Record<string, unknown> | null; counters: Array<Record<string, unknown>>; tokens: Array<Record<string, unknown>>; appointments: Array<Record<string, unknown>>; adminPreferences: Record<string, boolean>; profile: Record<string, unknown> }
const corsHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'Content-Type,Authorization', 'content-type': 'application/json' }

async function installApiMock(page: Page): Promise<MockState> {
  const state: MockState = { booking: null, counters: [], tokens: [{ _id: 'token-1', tokenNumber: 'A101', citizen: { fullName: 'Test Patient', phone: '+15550000001' }, department: { _id: department._id, name: department.name }, priority: 'normal', estimatedWaitingTime: 15, status: 'waiting', bookingDate: new Date().toISOString() }], appointments: [{ _id: 'appointment-1', appointmentId: 'AP-TEST', citizen: { fullName: 'Test Patient', phone: '+15550000001' }, department: { _id: department._id, name: department.name }, appointmentDate: '2026-12-15T00:00:00.000Z', appointmentTime: '09:00', status: 'pending' }], adminPreferences: { newAppointments: true, cancellations: true, delays: true, dailySummary: false }, profile: { id: 'citizen-1', fullName: 'Test Citizen', email: 'citizen@example.test', phoneNumber: '+15550000001', dateOfBirth: '1990-01-01', gender: 'Prefer not to say', address: { address: '1 Test Street', city: 'Test City', state: 'Test State', pinCode: '123456' }, accountStatus: 'active', createdAt: '2026-01-01T00:00:00.000Z' } }
  const counter = { _id: 'counter-1', counterNumber: 'CTR-BROWSER', name: 'Browser Test Counter', department: { _id: department._id, name: department.name }, status: 'available', currentServingToken: null, updatedAt: '2026-01-01T00:00:00.000Z' }
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api/, '')
    const method = request.method()
    const body = request.postDataJSON() as Record<string, unknown> | null
    let data: unknown = {}
    let status = 200
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders })
    if (path === '/auth/login' && method === 'POST') {
      const user = String(body?.email).startsWith('admin') ? admin : citizen
      data = { user, accessToken: user.role === 'admin' ? 'admin-test-token' : 'citizen-test-token', expiresIn: 900 }
    } else if (path === '/auth/me') data = { user: currentUser(request) }
    else if (path === '/auth/logout') data = { message: 'Logged out.' }
    else if (path === '/departments') data = { departments: [{ ...department, id: department._id }] }
    else if (path === '/tokens' && method === 'POST') {
      state.booking = body ?? {}
      data = { token: { id: 'token-1', tokenNumber: 'A101', department: { name: department.name }, bookingDate: new Date().toISOString(), preferredVisitDate: body?.preferredVisitDate, preferredTime: body?.preferredTime, visitType: body?.visitType, status: 'waiting', estimatedWaitingTime: 15 } }
    } else if (path === '/tokens/my' || path === '/appointments/my' || path === '/notifications/my' || path === '/documents/my') data = { items: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } }
    else if (path === '/tokens/token-1') data = { token: { id: 'token-1', tokenNumber: 'A101', department: { name: department.name }, bookingDate: new Date().toISOString(), status: 'waiting', estimatedWaitingTime: 15 } }
    else if (path === '/tokens/token-1/tracking') data = { tracking: { status: 'waiting', department: { name: department.name }, queuePosition: 2, currentlyServingToken: 'A099', estimatedWaitingTime: 15, assignedCounter: null } }
    else if (path === '/citizen/profile' && method === 'GET') data = { profile: state.profile }
    else if (path === '/citizen/profile' && method === 'PATCH') { state.profile = { ...state.profile, ...(body ?? {}) }; data = { profile: state.profile } }
    else if (path === '/admin/dashboard') data = { totalVisitors: 1, activeTokens: 0, departmentQueues: [] }
    else if (path === '/admin/tokens' && method === 'GET') data = { items: state.tokens, pagination: { page: 1, limit: 100, total: state.tokens.length, pages: 1 } }
    else if (path === '/admin/appointments' && method === 'GET') data = { items: state.appointments, pagination: { page: 1, limit: 100, total: state.appointments.length, pages: 1 } }
    else if (/^\/admin\/activity$/.test(path)) data = { items: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } }
    else if (path === '/admin/departments') data = { items: [department], pagination: { page: 1, limit: 100, total: 1, pages: 1 } }
    else if (path === '/admin/counters' && method === 'GET') data = { items: state.counters.map((item) => ({ ...counter, ...item })), pagination: { page: 1, limit: 100, total: state.counters.length, pages: 1 } }
    else if (path === '/admin/counters' && method === 'POST') { state.counters = [{ ...counter, ...(body ?? {}) }]; data = { ...state.counters[0] } }
    else if (path === '/admin/counters/counter-1/status' && method === 'PATCH') { state.counters = [{ ...(state.counters[0] ?? counter), status: body?.status === 'inactive' ? 'inactive' : String(body?.status) }]; data = { ...state.counters[0] } }
    else if (path === '/admin/tokens/token-1/call' && method === 'POST') { state.tokens[0].status = 'serving'; data = { token: state.tokens[0] } }
    else if (path === '/admin/appointments/appointment-1/approve' && method === 'POST') { state.appointments[0].status = 'approved'; data = { appointment: state.appointments[0] } }
    else if (path === '/admin/ai-insights/overview') data = insights()
    else if (path === '/admin/reports/overview') data = { overview: { totalTokens: 0, completedTokens: 0, averageEstimatedWaitMinutes: 0, cancelledTokens: 0 }, tokensByStatus: [], departments: [], daily: [] }
    else if (path === '/admin/profile' && method === 'GET') data = { ...admin, phoneNumber: '+15550000002' }
    else if (path === '/admin/profile' && method === 'PATCH') data = { ...admin, ...body, phoneNumber: body?.phoneNumber }
    else if (path === '/admin/notification-preferences' && method === 'GET') data = { ...state.adminPreferences }
    else if (path === '/admin/notification-preferences' && method === 'PATCH') { state.adminPreferences = { ...state.adminPreferences, ...(body ?? {}) } as Record<string, boolean>; data = state.adminPreferences }
    else if (path === '/admin/settings' && method === 'GET') data = { hospitalName: 'Test Hospital', workingHours: [] }
    else if (path === '/admin/settings' && method === 'PATCH') data = body ?? {}
    else if (path === '/admin/queues') data = { items: [] }
    return route.fulfill({ status, headers: corsHeaders, body: JSON.stringify({ status: status === 200 ? 'success' : 'error', data }) })
  })
  return state
}

function currentUser(request: Request) {
  return request.headers()['authorization']?.includes('admin-test-token') ? admin : citizen
}

async function signIn(page: Page, email: string) {
  await page.goto('/')
  await expect(page.locator('body')).toContainText('Skip the Queue', { timeout: 15_000 })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in to SmartQueue AI' })).toBeVisible({ timeout: 15_000 })
  await page.getByLabel('Email address').fill(email)
  await page.locator('#login-password').fill('Development-Test-Password-123!')
  await page.getByRole('button', { name: 'Sign In' }).click()
}

function watchBrowserErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  return errors
}

function tomorrow() {
  const value = new Date()
  value.setDate(value.getDate() + 1)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function insights() {
  return {
    dataSource: 'aggregated MongoDB token and counter data', peakHours: [], waiting: { count: 0, averageEstimatedWaitMinutes: 0 }, departmentPerformance: [], recommendations: [],
    operationalSummary: { activeCounters: 0, appointments: { total: 0, completed: 0, cancelled: 0, completionRate: 0, cancellationRate: 0 }, tokenOutcomes: { completed: 0, cancelled: 0, completionRate: 0, cancellationRate: 0 } },
    queuePressure: [], historicalQueueTrend: [], analysis: { provider: 'rule-based', model: null, timestamp: new Date().toISOString(), fallbackReason: 'missing-api-key' }, generatedAnalysis: null,
    peakPeriodAnalysis: { historical: { busiestHours: [], busiestDays: [] }, forecast: { status: 'insufficient-historical-data', method: 'test', minimumObservedDays: 28, observedDays: 0, historicalTokenCount: 0, expectedByWeekday: [] } },
    waitTimeAnalysis: { timestamp: new Date().toISOString(), disclaimer: 'Estimates only.', departments: [] }, explanation: 'Rule-based test response.',
  }
}
