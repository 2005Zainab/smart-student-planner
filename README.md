# Smart Student Planner 

Smart Student Planner is a web app that helps students plan their studies, track due dates and organize their workflow in one place.

## Features

- Task management
  -  Add, Edit, Delete, archive & unarchive tasks
  -  Task labels, search bar function across pages
  -  Attach files and links to tasks
  -  Assignment progress tracking, task priority tracking by deadline
  -  Recurring tasks: Daily, Weekly, Monthly
  -  Recurring tasks: change frequency, turn off or on, delete one or whole series
  -  Task focus timer

- Dashboard, Personalisation, AI help
  - Overview of workload 
  - Preset and custom themes
  - Sidebar with toggle
  - Ai chatbot for schedule and study recommendations

- Calendar, Timeline, Schedule
  -  Calendar view of assignments
  -  Overdue items marked on calender
  -  Assessments timeline and deadlines
  -  Schedule view with dates and times

- Reminders, Notifications 
  - Reminders for deadlines and alert times
  - Email reminders

 - Accounts, Security
   - Account creation and access to tasks from any device
   - Password reset and email link login, 2FA option in settings
   - Option to change Username and profile picture

## Technology stack / Dependencies

- **Frontend:** React, Vite, React Router, Tailwind CSS, and Firebase
- **Backend:** Node.js, Express, and Firebase Admin SDK
- **Database and authentication:** Firebase Authentication and Cloud Firestore
- **Email:** Nodemailer with Gmail
- **Testing:** Vitest, Testing Library, and SuperTest
- **Code quality:** ESLint and Prettier

The frontend and backend are independent Node.js applications in the
`frontend/` and `backend/` directories. The project currently uses Node.js 24
in CI.

## Prerequisites

- Node.js 24 or a compatible current Node.js release
- npm
- A Firebase project with Authentication and Cloud Firestore enabled
- A Firebase Admin SDK service-account key for the backend
- Gmail credentials if email reminders are required

## Installation

Requires setting up a Firebase Project (Authentication and Firestore enabled). Create one at https://console.firebase.google.com then use its config values in the .env files below
1. Clone the repo and open the project folder
2. Install the dependencies using "npm ci" in the backend and frontend (requires Node.js installed, which includes npm)
3. Add the environment files and replace the your-value-here with proper values
4. Generate service account key in Firebase: Project settings -> Service Accounts -> Generate private key. Save the downloaded file in the backend folder and rename it to serviceAccountKey.json
5. In a terminal, cd to the backend folder and run "npm run dev"
6. In a second terminal, cd to the frontend folder and run "npm run dev"
7. Open localhost using the local URL shown in the frontend terminal

Clone the repository and install dependencies for both applications:

```bash
git clone https://github.com/2005Zainab/smart-student-planner.git
cd smart-student-planner

cd frontend
npm ci

cd ../backend
npm ci
```

## Environment configuration

### Frontend

Create `frontend/.env` with the Firebase web-app configuration:

```dotenv
VITE_API_KEY=your-firebase-api-key
VITE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_PROJECT_ID=your-firebase-project-id
VITE_STORAGE_BUCKET=your-firebase-storage-bucket
VITE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_APP_ID=your-firebase-app-id
VITE_MEASUREMENT_ID=your-measurement-id
VITE_APPCHECK_DEBUG_TOKEN=your-app-check-debug-token
```

The values are used by
[`frontend/src/shared/auth.js`](frontend/src/shared/auth.js). Configure a
real Firebase App Check reCAPTCHA site key before deploying to production.

### Backend

Place the Firebase Admin SDK service-account JSON file at
`backend/serviceAccountKey.json`. Do not commit this file or share its
contents.

Create `backend/.env` for server-side settings:

```dotenv
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret
GMAIL_USER=your-gmail-address
GMAIL_APP_PASSWORD=your-gmail-app-password
```

`GMAIL_USER` and `GMAIL_APP_PASSWORD` are only required for sending email
reminders. Use a Gmail app password rather than your normal Gmail password.

## Running the project

Start the backend in one terminal:

```bash
cd backend
npm run dev
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open the Vite development URL shown in the terminal, normally
`http://localhost:5173`. The backend listens on port `3000` by default.

To run the backend without file watching, use `npm start` instead of
`npm run dev`.

## Tests and code quality

Run the frontend or backend test suite from its respective directory:

```bash
npm test
```

Run linting and formatting checks:

```bash
npm run lint
npm run format:check
```

The continuous integration workflow runs tests, ESLint, and Prettier checks
for both applications.

## Authors

- **Zainab Obidi** – 2005Zainab
- **Ella Perry** – craniumdonuts-blip
- **Cayden Isted** – wodahsedoc
- **Nathan Palileo** – nathanpee2006
- **Cameron Reid** – sfc6994







