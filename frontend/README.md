# Gatekeeper - Advanced URL Security Scanner

A production-quality frontend application for the Gatekeeper cybersecurity project. Built with React 19, TypeScript, Vite, and Tailwind CSS.

## Features

- **URL Scanner**: Real-time URL input with validation, scanning states, and results display
- **Multi-layer Analysis Display**: Shows lexical analysis, threat intelligence, and page inspection results
- **Three Verdict States**: Safe, Suspicious, and Dangerous with appropriate visual indicators
- **Detailed Analysis Modal**: Expandable detailed view with all detection indicators
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Accessibility**: WCAG 2.1 compliant with proper ARIA labels, keyboard navigation, and screen reader support
- **Clean Architecture**: Separation of concerns with services, hooks, components, and types

## Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Oxlint** for linting

## Project Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI components (Button, Input, Card, Badge, Progress, Modal)
│   ├── scanner/         # Scanner-specific components (ScannerForm, ScanResultCard, DetailedAnalysisModal, ScanningState)
│   └── layout/          # Layout components (Navbar, Footer)
├── pages/
│   ├── HomePage.tsx     # Landing page with features, how it works, detection methods, security, about
│   └── ScannerPage.tsx  # Main scanner page
├── services/
│   ├── scannerService.ts      # API service for scanning URLs
│   ├── mockScannerService.ts  # Development mock service
│   └── responseAdapter.ts     # Backend response normalization
├── hooks/
│   └── useScanner.ts    # Scanner state management hook
├── utils/
│   └── helpers.ts       # Utility functions (URL validation, formatting, etc.)
├── types/
│   └── scanner.ts       # TypeScript types for scanner
└── assets/              # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_API_TIMEOUT=30000
VITE_USE_MOCK=true
```

- `VITE_API_BASE_URL`: Base URL for the Gatekeeper API
- `VITE_API_TIMEOUT`: Request timeout in milliseconds
- `VITE_USE_MOCK`: Set to `true` to use the mock service for development

## API Integration

The frontend is designed to work with the Gatekeeper backend API. The expected API endpoints:

- `POST /api/scan` - Scan a URL
  - Request: `{ url: string }`
  - Response: Normalized via `responseAdapter.ts`
- `GET /api/health` - Health check

The frontend uses a response adapter to normalize backend responses to the frontend `ScanResult` model, allowing flexibility if the backend API structure changes.

## Scanner States

1. **Idle**: Initial state, shows scanner input and features
2. **Validating**: URL validation in progress
3. **Scanning**: Multi-step scanning animation (URL Analysis → Threat Intelligence → Page Inspection)
4. **Success**: Displays result card with verdict, risk score, and "View Detailed Analysis" button
5. **Error**: Shows error message with "Try Again" button

## Verdict Types

- **Safe** (Green): No threats detected
- **Suspicious** (Yellow): Suspicious characteristics found, caution advised
- **Dangerous** (Red): Confirmed phishing/malicious site

## Accessibility

- Semantic HTML structure
- Proper heading hierarchy
- ARIA labels and live regions
- Keyboard navigation support
- Focus management
- Screen reader announcements for scan completion
- Color contrast compliance

## Security

- No `dangerouslySetInnerHTML` usage
- All URLs and API responses treated as untrusted
- No hardcoded secrets or API keys
- Environment-based configuration
- Input sanitization and validation

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Proprietary - Gatekeeper Project