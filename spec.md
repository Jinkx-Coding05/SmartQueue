# SMARTQUEUE AI
## Master Project Specification – Codex Development Guide

**Project Name:** SmartQueue AI  
**Project Type:** AI-powered Queue & Appointment Management Platform  
**Development Approach:** Frontend First, Backend Integration Later  
**Primary Goal:** Build a professional, accessible, responsive and functional platform suitable for a national-level hackathon.

---

# 1. PROJECT VISION

SmartQueue AI is an intelligent queue and appointment management platform designed for government hospitals and public service offices.

The platform aims to reduce unnecessary waiting, improve appointment scheduling, make queue information transparent and simplify the experience for citizens.

It should work for:
- Citizens using smartphones.
- Elderly people.
- People with limited technical knowledge.
- Hospital and office administrators.
- Staff members managing service counters.

The application must prioritize simplicity, accessibility, reliability and usability.

# 2. PROBLEM STATEMENT

Citizens frequently experience problems while accessing public services:

1. Long and unpredictable queues.
2. No accurate information about waiting times.
3. Fixed appointments that do not account for delays.
4. Citizens arriving without required documents.
5. Poor communication about queue changes.
6. Limited digital accessibility for people without smartphones.
7. Lack of transparent public service statistics.
8. Difficulty managing staff and service counters.

# 3. PROPOSED SOLUTION

SmartQueue AI provides a centralized platform that allows citizens to:

- Register and log in.
- Select hospitals or government service offices.
- Book digital queue tokens.
- Track live queue positions.
- View estimated waiting times.
- Receive appointment updates.
- Get personalized document checklists.
- Access public waiting-time statistics.

Administrators can:

- Monitor active queues.
- Manage service counters.
- Manage tokens and appointments.
- Prioritize emergency cases.
- Monitor waiting-time statistics.
- View AI-generated queue predictions and recommendations.

# 4. TECHNOLOGY STACK

## Frontend

- React.js
- Vite
- TypeScript
- Tailwind CSS
- React Router DOM
- Lucide React
- Recharts
- Three.js
- React Three Fiber
- React Three Drei
- Framer Motion

Use Three.js and React Three Fiber only when they provide meaningful value. Do not add unnecessary 3D elements to ordinary dashboards.

## Backend – Future Integration

- Node.js
- Express.js
- MongoDB
- Mongoose
- Gemini API

Do not implement the backend during the initial frontend development phase.

## Development Tools

- VS Code
- Git and GitHub
- npm
- Browser Developer Tools
- Codex

# 5. UI/UX DESIGN SYSTEM

## Design Philosophy

Create a clean, minimal, modern healthcare SaaS interface.

The design should feel trustworthy, professional, friendly and easy to understand.

Avoid:
- Excessive animations.
- Overloaded dashboards.
- Too many gradients.
- Unnecessary glassmorphism.
- Tiny text.
- Confusing navigation.
- Excessive 3D effects.
- Unnecessary decorative elements.

## Color Palette

Use the following initial color system:

- Primary Navy: #153E75
- Primary Blue: #2878D0
- Light Blue: #EAF3FC
- Background: #F7F9FC
- Surface: #FFFFFF
- Main Text: #253247
- Secondary Text: #64748B
- Success: #16A477
- Warning: #F5A623
- Error: #DC5252
- Border: #E2E8F0

Use colors consistently through reusable design tokens.

## Typography

- Primary Font: Inter
- Headings: Semibold or Bold.
- Body Text: Regular.
- Buttons: Medium or Semibold.

Maintain readable font sizes and sufficient spacing.

## UI Components

Create reusable components for:

- Buttons
- Input fields
- Dropdowns
- Navigation bars
- Sidebar
- Cards
- Status badges
- Modal dialogs
- Tables
- Loading states
- Empty states
- Notifications
- Confirmation dialogs
- Form validation messages

## Responsive Design

The application must support:

- Desktop
- Laptop
- Tablet
- Mobile

Use mobile-first responsive layouts.

Ensure buttons and interactive elements have comfortable touch targets, preferably around 44px or larger.

# 6. USER ROLES

The application will support two primary roles.

## A. Citizen

Citizens can:

- Register and log in.
- Book queue tokens.
- View appointments.
- Track live queue positions.
- View estimated waiting times.
- Check required documents.
- View public service statistics.

## B. Administrator

Administrators can:

- Access the admin dashboard.
- Monitor queues.
- Manage tokens.
- Manage service counters.
- Manage appointments.
- Prioritize emergency cases.
- View analytics.
- Access AI intelligence insights.

Implement role-based navigation and protected frontend routes using mock authentication initially.

# 7. APPLICATION PAGES

Build the following pages in the specified order.

## PAGE 1: LANDING PAGE

Route: /

Sections:

1. Navigation bar.
   - SmartQueue AI logo.
   - Home.
   - How It Works.
   - Features.
   - Public Statistics.
   - Login.
   - Get Started button.

2. Hero section.
   - Main heading: "Skip the Queue. Save Your Time."
   - Supporting description explaining SmartQueue AI.
   - Primary CTA: Book Your Token.
   - Secondary CTA: Explore How It Works.
   - Clean visual representation of a digital queue.

3. How It Works.
   - Select a service.
   - Book your token.
   - Track your queue.
   - Visit when your turn approaches.

4. Features section.
   - Smart Token Generation.
   - Live Queue Tracking.
   - AI Waiting-Time Prediction.
   - Document Assistant.
   - Appointment Management.
   - Accessible Notifications.

5. Benefits section.
   - Save time.
   - Reduce overcrowding.
   - Better planning.
   - Transparent information.

6. Public statistics preview.
   - Active service centers.
   - Average waiting time.
   - Tokens served.
   - Service availability.

7. Footer.
   - About.
   - Features.
   - Contact.
   - Privacy Policy.
   - Terms and Conditions.

Design requirements:
- Clean and trustworthy.
- Simple navigation.
- Large readable typography.
- Strong CTA buttons.
- Subtle animations.
- Mobile responsive.

A 3D queue visualization may be used in the hero section only if it improves understanding and does not affect performance or accessibility.

## PAGE 2: AUTHENTICATION

Routes:
- /login
- /register
- /verify-otp

Features:

- Login form.
- Registration form.
- Citizen/Admin role selection.
- Name.
- Email.
- Phone number.
- Password.
- Password visibility toggle.
- Form validation.
- Demo OTP verification.
- Success and error messages.

Use mock authentication.

Never imply that real SMS or email OTP delivery is implemented.

## PAGE 3: CITIZEN DASHBOARD

Route: /citizen/dashboard

Sections:

1. Welcome message.
2. Quick action: Book a Token.
3. Upcoming appointments.
4. Active queue status.
5. Estimated waiting time.
6. Recent activity.
7. Notifications.

The most important citizen actions must be immediately visible.

## PAGE 4: TOKEN BOOKING

Route: /citizen/book-token

Booking flow:

Step 1: Select service location.
- Hospital or government office.
- Location information.
- Available services.

Step 2: Select department.
- General Medicine.
- Cardiology.
- Orthopedics.
- Other sample departments.

Step 3: Select date and time.
- Available dates.
- Available appointment slots.
- Slot availability.

Step 4: Confirm booking.
- Selected service.
- Date.
- Time.
- Citizen information.

Step 5: Generate token.
- Unique demo token number.
- Booking confirmation.
- Estimated waiting time.
- Track Queue button.

Use a simple multi-step interface with clear progress indicators.

## PAGE 5: LIVE QUEUE TRACKING

Route: /citizen/queue/:tokenId

Display:

- Token number.
- Current serving token.
- People ahead.
- Estimated waiting time.
- Queue status.
- Service counter.
- Appointment information.

Use mock data and simulate queue movement with a controlled demo mechanism.

Clearly label simulated information as demo data.

## PAGE 6: DOCUMENT ASSISTANT

Route: /citizen/documents

Features:

- Required document checklist.
- Completed documents.
- Missing documents.
- Visit preparation instructions.
- Service-specific document requirements.
- Progress indicator.

Allow users to mark documents as completed.

Use sample document requirements for demonstration.

## PAGE 7: ADMIN DASHBOARD

Route: /admin/dashboard

Display overview cards:

- Total Visitors.
- Active Tokens.
- Average Waiting Time.
- Completed Appointments.
- Active Counters.

Additional sections:

- Live queue overview.
- Token management table.
- Counter management.
- Staff status.
- Emergency priority controls.
- Recent activity.

Use realistic mock data.

## PAGE 8: AI INTELLIGENCE DASHBOARD

Route: /admin/ai-insights

Display:

- Predicted waiting times.
- Queue congestion.
- Department-wise workload.
- Appointment delay alerts.
- Peak-hour predictions.
- AI recommendations.

Use Recharts for visual analytics.

Initially use deterministic mock predictions and sample recommendations.

Do not claim that real AI prediction is active until the Gemini/backend integration exists.

## PAGE 9: PUBLIC TRANSPARENCY PAGE

Route: /public-statistics

Display:

- Hospital-wise waiting times.
- Service-wise waiting times.
- Active tokens.
- Average waiting time.
- Service availability.
- Daily visitor statistics.
- Department-wise information.

This page should be accessible without authentication.

# 8. FRONTEND ARCHITECTURE

Organize the application using a feature-based and reusable component structure.

Suggested structure:

```text
SmartQueue-AI/
│
├── public/
│   ├── images/
│   └── icons/
│
├── src/
│   ├── assets/
│   │
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   ├── navigation/
│   │   └── ui/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── citizen/
│   │   ├── booking/
│   │   ├── queue/
│   │   ├── documents/
│   │   ├── admin/
│   │   ├── ai-insights/
│   │   └── public-statistics/
│   │
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── CitizenDashboard.tsx
│   │   ├── BookingPage.tsx
│   │   ├── QueueTrackingPage.tsx
│   │   ├── DocumentAssistantPage.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── AIInsightsPage.tsx
│   │   └── PublicStatisticsPage.tsx
│   │
│   ├── routes/
│   ├── hooks/
│   ├── services/
│   │   ├── api/
│   │   └── mock/
│   │
│   ├── context/
│   ├── types/
│   ├── utils/
│   ├── constants/
│   ├── styles/
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

This is the target architecture. Adapt it if a simpler structure is more appropriate, but keep responsibilities organized.

# 9. ROUTING AND NAVIGATION

Use React Router DOM.

Public routes:

- /
- /login
- /register
- /verify-otp
- /public-statistics

Citizen routes:

- /citizen/dashboard
- /citizen/book-token
- /citizen/queue/:tokenId
- /citizen/documents

Admin routes:

- /admin/dashboard
- /admin/ai-insights

Implement:

- Protected routes.
- Role-based route access.
- Unauthorized access handling.
- Not Found page.
- Consistent navigation.

Mock authentication should be isolated so it can later be replaced by real backend authentication.

# 10. MOCK DATA AND FRONTEND FUNCTIONALITY

The entire frontend must be demonstrable without a backend.

Create realistic mock data for:

- Citizens.
- Hospitals.
- Government service offices.
- Departments.
- Appointment slots.
- Queue tokens.
- Service counters.
- Staff.
- Waiting-time statistics.
- AI recommendations.

Keep mock data separate from UI components.

Create service interfaces that can later communicate with Express APIs.

Avoid hardcoding business data directly inside page components.

Functional requirements:

- Navigation must work.
- Forms must validate.
- Buttons must perform meaningful actions.
- Booking must generate a demo token.
- Queue tracking must display realistic sample information.
- Document checklists must be interactive.
- Admin controls must update demo state.
- Charts must display meaningful data.
- Role switching must work in the demo.

Do not create buttons that look functional but do nothing.

# 11. ACCESSIBILITY REQUIREMENTS

Accessibility is a core feature, not an optional enhancement.

Implement:

- Readable text.
- High color contrast.
- Keyboard navigation.
- Visible focus states.
- Proper form labels.
- Accessible validation messages.
- Semantic HTML.
- Screen-reader-friendly status updates.
- Large touch-friendly controls.
- Clear success/error messages.

Do not communicate queue status using color alone. Include readable status text.

Keep the interface simple enough for elderly and first-time users.

# 12. THREE.JS REQUIREMENTS

Three.js is optional and should be used selectively.

Possible use cases:

- Interactive queue visualization on the landing page.
- Small 3D hospital/service-center representation.
- A visual explanation of how digital queue management works.

Rules:

- Do not use 3D in every page.
- Avoid heavy 3D scenes.
- Provide a static fallback.
- Respect reduced-motion preferences.
- Keep mobile performance in mind.
- Never allow 3D animations to interfere with primary actions.

The core application must remain useful without WebGL.

# 13. DEVELOPMENT WORKFLOW

Follow this sequence strictly.

## PHASE 1: PROJECT INITIALIZATION

1. Check Node.js and npm.
2. Initialize React + Vite + TypeScript.
3. Install required dependencies.
4. Configure Tailwind CSS using the compatible version.
5. Configure React Router.
6. Configure Lucide React.
7. Set up global styles.
8. Create the initial folder architecture.
9. Start the development server.
10. Verify the initial application.

Do not overwrite existing files without inspecting them.

## PHASE 2: DESIGN SYSTEM

1. Establish color tokens.
2. Configure typography.
3. Create reusable buttons.
4. Create form components.
5. Create reusable cards.
6. Create navigation components.
7. Create layout components.
8. Verify responsiveness.

## PHASE 3: PAGE-BY-PAGE DEVELOPMENT

Implement in this order:

1. Landing Page.
2. Authentication.
3. Citizen Dashboard.
4. Token Booking.
5. Live Queue Tracking.
6. Document Assistant.
7. Admin Dashboard.
8. AI Intelligence Dashboard.
9. Public Transparency Page.

For every page:

1. Suggest 2–3 suitable design reference directions.
2. Provide exact search keywords for Dribbble, Behance, Figma Community and Three.js examples when relevant.
3. Wait for the user to select a reference or share a screenshot.
4. Analyze the selected reference.
5. Prepare an implementation plan.
6. Implement the page.
7. Test the page.
8. Fix all identified issues.
9. Wait for approval before starting the next page.

Do not blindly copy existing templates. Build an original SmartQueue AI design.

## PHASE 4: FRONTEND INTEGRATION

- Connect all routes.
- Connect role-based navigation.
- Share application state where needed.
- Connect mock services.
- Verify complete user flows.
- Check desktop and mobile layouts.

## PHASE 5: FINAL TESTING

Check:

- TypeScript errors.
- Build errors.
- Browser console errors.
- Broken navigation.
- Form validation.
- Responsive layouts.
- Accessibility basics.
- Empty and loading states.
- User role restrictions.
- Performance issues.

Fix errors before declaring the frontend complete.

# 14. CODING STANDARDS

Follow these rules:

1. Use TypeScript throughout the frontend.
2. Avoid `any` wherever possible.
3. Use functional React components.
4. Keep components reusable.
5. Separate UI from business logic.
6. Separate mock data from UI.
7. Use meaningful variable and component names.
8. Keep files reasonably small.
9. Avoid unnecessary dependencies.
10. Avoid duplicate code.
11. Use proper error handling.
12. Maintain consistent formatting.
13. Never expose API keys in frontend code.
14. Never overwrite working files without inspection.
15. Use environment variables for configurable frontend settings.
16. Keep future backend integration in mind.

# 15. FUTURE BACKEND INTEGRATION

After the frontend is sufficiently complete, integrate:

- Node.js and Express.js APIs.
- MongoDB database.
- Gemini API.
- Real authentication.
- Real OTP services.
- Real-time queue updates.
- Waiting-time prediction.
- Notification services.
- SMS and voice access.

Keep API service interfaces separate from mock service implementations.

Potential future API groups:

- /api/auth
- /api/users
- /api/hospitals
- /api/departments
- /api/appointments
- /api/tokens
- /api/queues
- /api/documents
- /api/admin
- /api/analytics
- /api/ai

Do not implement these backend endpoints during the initial frontend phase.

# 16. DEFINITION OF DONE

The frontend is considered complete when:

- All nine pages are implemented.
- Navigation works across the application.
- Citizen and Admin roles work in demo mode.
- A citizen can complete a token-booking flow.
- A generated token can be tracked.
- Document checklists are interactive.
- Admin can manage demo queues.
- Analytics display realistic mock data.
- Public statistics are accessible without login.
- All major pages are responsive.
- No known critical build or runtime errors remain.
- The frontend is ready for backend integration.

# 17. IMPORTANT INSTRUCTIONS TO CODEX

You are acting as a Senior Frontend Engineer and Software Architect.

Treat this document as the project's source of truth.

IMPORTANT DEVELOPMENT RULES:

1. Do not generate the entire application in one attempt.
2. Work incrementally.
3. Inspect files before modifying them.
4. Preserve working code.
5. Never assume dependencies are installed.
6. Explain important technical decisions.
7. Give exact file paths when describing changes.
8. Prefer complete updated files when making substantial changes.
9. Do not move to the next page without user approval.
10. Run appropriate tests after each milestone.
11. Fix errors instead of hiding them.
12. Do not start backend development without explicit approval.
13. Do not add unnecessary features outside the specification.
14. Do not sacrifice usability for visual effects.
15. Keep the application clean, accessible and hackathon-demo-ready.

**MOST IMPORTANT: Follow the user's step-by-step development workflow. The user must be involved in design selection and milestone verification.**

---

# FIRST TASK FOR CODEX

Begin with PHASE 1 – PROJECT INITIALIZATION.

The project root directory is:

SmartQueue-AI

The user is starting from scratch.

Your first responsibility is to:

1. Check the available Node.js and npm versions.
2. Inspect the current root directory.
3. Initialize a React + Vite + TypeScript project if it is not already initialized.
4. Install and configure the required frontend dependencies.
5. Configure Tailwind CSS and React Router.
6. Create the basic folder architecture.
7. Start the Vite development server.
8. Verify that the application runs successfully.

Do not implement all nine pages yet.

After successful setup, report:

- Files created.
- Dependencies installed.
- Commands executed.
- Development server URL.
- Build and typecheck results.
- Any remaining issues.

Then STOP and wait for the user's approval.

The next milestone will be Landing Page design reference selection.