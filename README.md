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
  - Ai chatbot for schedule recommendations

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

## Setup Steps 

- Requires setting up a Firebase Project (Authentication and Firestore enabled). Create one at https://console.firebase.google.com then use its config values in the .env files below
1. Clone the repo and open the project folder
2. Install the dependencies using "npm i" in the backend and frontend (requires Node.js installed, which includes npm)
3. Add the environment files and replace the your-value-here with proper values
4. Generate service account key in Firebase: Project settings -> Service Accounts -> Generate private key. Save the downloaded file in the backend folder and rename it to serviceAccountKey.json
5. In a terminal, cd to the backend folder and run "npm run dev"
6. In a second terminal, cd to the frontend folder and run "npm run dev"
7. Open the local host using the local URL shown in the frontend terminal

### Backend

Create backend/.env and paste in:
```
apiKey="your-value-here"
authDomain="your-value-here"
projectId="your-value-here"
storageBucket="your-value-here"
messagingSenderId="your-value-here"
appId="your-value-here"
measurementId="your-value-here"
JWT_SECRET=your-value-here
```
- JWT_SECRET can be any long random string

### Frontend

Create frontend/.env and paste in: 
```
VITE_API_KEY="your-value-here"
VITE_AUTH_DOMAIN="your-value-here"
VITE_PROJECT_ID="your-value-here"
VITE_STORAGE_BUCKET="your-value-here"
VITE_MESSAGING_SENDER_ID="your-value-here"
VITE_APP_ID="your-value-here"
VITE_MEASUREMENT_ID="your-value-here"
VITE_APPCHECK_DEBUG_TOKEN="your-value-here"
```







