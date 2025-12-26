# EduManager Pro: Education Center Management System

EduManager Pro is a comprehensive web-based application designed to streamline operations for Vietnamese language learning centers. Built with React 19, TypeScript, and Firebase, it offers robust features for managing students, classes, attendance, staff, contracts, and financial aspects.

## Key Features

*   **Student Management**: Enrollment, status tracking, detailed profiles.
*   **Class & Attendance**: Class scheduling, real-time attendance, history.
*   **Staff & HR**: Staff profiles, roles, salary configuration, work confirmations.
*   **Financials**: Contract management, invoicing, debt tracking, revenue reports.
*   **CRM**: Lead management, campaign tracking, customer feedback.
*   **Reporting**: Dashboards, training and monthly reports.

## Tech Stack

*   **Frontend**: React 19, TypeScript, Vite 7, TailwindCSS
*   **Backend**: Firebase (Auth, Firestore, Cloud Functions, Hosting)
*   **Routing**: `react-router-dom` with `HashRouter`
*   **Charting**: Recharts
*   **Icons**: `lucide-react`

## Quick Start (Development)

To get EduManager Pro running locally, follow these steps:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-repo/edumanager-pro.git
    cd edumanager-pro
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Firebase**:
    Create a `.env.local` file in the project root and add your Firebase project configuration:
    ```
    VITE_FIREBASE_API_KEY=YOUR_API_KEY
    VITE_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
    VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
    VITE_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
    VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
    VITE_FIREBASE_APP_ID=YOUR_APP_ID
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY  # Optional, for AI features
    ```
4.  **Start Firebase Emulators (for local development)**:
    ```bash
    firebase emulators:start
    ```
5.  **Run the development server**:
    ```bash
    npm run dev
    ```
    The application will be accessible at `http://localhost:5173` (or another port if 5173 is in use).

## Testing

*   **Run tests in watch mode**: `npm run test`
*   **Run tests once (for CI/CD)**: `npm run test:run`
*   **Generate coverage report**: `npm run test:coverage`

## Deployment

To deploy to Firebase Hosting:
```bash
npm run build
firebase deploy
```

For more detailed documentation, refer to the `docs/` directory.
