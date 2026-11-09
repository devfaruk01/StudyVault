
# StudyVault

**Personal Digital Study Management System**

StudyVault is a personal study management application designed to organize books, chapters, topics, notes, and study progress in one place.

The project uses HTML, CSS, and Vanilla JavaScript for the frontend, Google Apps Script for backend operations, and Google Sheets as the primary database.

---

## 1. Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | User interface and responsive design |
| Vanilla JavaScript | Application logic |
| GSAP | Animations |
| Google Apps Script | Backend API |
| Google Sheets | Primary database |
| LocalStorage | Optional frontend cache |

No React, Vue, or other frontend frameworks are required.

---

## 2. Project Structure

```text
StudyVault/
│
├── index.html
│
├── css/
│   └── style.css
│
├── js/
│   ├── app.js
│   ├── animations.js
│   └── data.js
│
├── assets/
│   ├── images/
│   └── icons/
│
└── backend/
    └── google-apps-script/
        ├── Code.gs
        ├── appsscript.json
        └── README.md
```

### Frontend Files

- `index.html` — Main application structure.
- `style.css` — Design and responsive styling.
- `app.js` — Application logic and UI rendering.
- `data.js` — Data management and backend communication.
- `animations.js` — GSAP animations.

### Backend Files

- `Code.gs` — Google Apps Script backend.
- `appsscript.json` — Apps Script project configuration.
- `README.md` — Project documentation.

---

## 3. Google Sheets Database Setup

StudyVault uses Google Sheets as its primary database.

### Step 1: Create a Spreadsheet

1. Open https://sheets.google.com
2. Create a new blank spreadsheet.
3. Rename it:

   `StudyVault Database`

### Step 2: Create Database Sheets

Create these four tabs:

1. Books
2. Chapters
3. Topics
4. Notes

### Step 3: Add Column Headers

The first row of each sheet must contain the following headers.

#### Books

```text
id | title | subject | description | createdAt | updatedAt
```

#### Chapters

```text
id | bookId | title | description | createdAt | updatedAt
```

#### Topics

```text
id | bookId | chapterId | title | notes | completed | completionDate | createdAt | updatedAt
```

#### Notes

```text
id | bookId | chapterId | topicId | title | content | createdAt | updatedAt
```

**Important:** Keep the column names exactly as written. Do not add spaces or change capitalization.

---

## 4. Google Apps Script Setup

### Step 1: Open Apps Script

From your Google Spreadsheet:

1. Click Extensions.
2. Select Apps Script.
3. The Apps Script editor will open.

### Step 2: Add Backend Code

1. Open the `Code.gs` file in this project.
2. Copy its complete contents.
3. Replace the default code in the Apps Script editor.
4. Save the project.

### Step 3: Configure the Manifest

1. Open Apps Script Project Settings.
2. Enable **Show "appsscript.json" manifest file in editor**.
3. Return to the editor.
4. Open `appsscript.json`.
5. Replace its contents with the project's manifest configuration.
6. Save.

---

## 5. Configure Script Properties

The backend expects two Script Properties.

Open:

**Apps Script → Project Settings → Script Properties**

Add:

| Property | Value |
|---|---|
| STUDYVAULT_SPREADSHEET_ID | Your Google Spreadsheet ID |
| STUDYVAULT_OWNER_EMAIL | Your Google account email |

### How to find Spreadsheet ID

A spreadsheet URL looks like this:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

Copy only the `SPREADSHEET_ID` portion.

Do not share your spreadsheet ID or account details publicly.

---

## 6. Important Authentication and Security Notes

StudyVault's current backend checks the active Google user's email against `STUDYVAULT_OWNER_EMAIL`.

However, Google Apps Script does not always provide the active user's email. Availability depends on the deployment configuration and Google account context.

If the email is unavailable, the current backend rejects the request.

Before deployment, we must verify:

- Which account executes the web app.
- Whether the active user's email is available.
- Whether the deployment access setting supports the intended authentication.
- Whether the frontend can communicate with the deployed Apps Script endpoint.
- Whether browser redirects and CORS affect the request.

**Security warning:**

Do not select "Anyone" for web app access without understanding the consequences. A publicly accessible endpoint can expose database operations if authentication is not correctly implemented.

Do not treat the current configuration as production-ready or fully secure until authentication and access controls have been tested.

---

## 7. Frontend and Backend Connection

The frontend API configuration is located in:

```text
js/data.js
```

The configuration currently contains:

```javascript
API_URL: '',
```

The deployed Apps Script URL will eventually be configured here.

However, the frontend and backend request formats still need to be integrated and tested. Do not assume that entering a deployment URL alone will make the application work.

---

## 8. Known Integration Tasks

Before the first working deployment, these issues must be resolved.

### 1. Topic Status Compatibility

The frontend currently uses:

```text
not-started
in-progress
completed
```

The current backend stores:

```text
completed: true / false
```

We need to decide on one consistent data structure and update the necessary files.

### 2. API Request Compatibility

The backend currently expects:

- `collection`
- `record`
- `id`
- `changes`

The frontend data layer must send compatible request payloads.

### 3. Authentication

We must verify the Google Apps Script identity and authorization behavior.

### 4. CORS and API Communication

We must test whether the frontend can successfully send requests to the deployed Apps Script web app and receive responses.

### 5. CRUD Testing

All of these operations must be tested:

- Create a book.
- Update a book.
- Delete a book.
- Create chapters.
- Create and update topics.
- Update topic completion.
- Create and edit notes.
- Delete records.
- Reload the application and verify that data persists.

---

## 9. Recommended Testing Order

Follow this order when integration begins:

1. Verify Google Sheets and its four database tabs.
2. Connect Apps Script to the spreadsheet.
3. Test the backend health-check endpoint.
4. Verify authentication.
5. Resolve frontend/backend API compatibility.
6. Test book operations.
7. Test chapter operations.
8. Test topic operations.
9. Test notes operations.
10. Test dashboard statistics.
11. Test search and filters.
12. Test responsive layout.
13. Test data persistence and security.

---

## 10. Current Project Status

The initial frontend and backend source files have been prepared.

However, the project is not yet fully integrated.

The next development phase is:

**Google Sheets Setup → Backend Integration → Authentication → API Testing → Frontend Connection**

Complete each step carefully before moving to the next one.

---

**Project Name:** StudyVault  
**Architecture:** HTML + CSS + Vanilla JavaScript + Google Apps Script + Google Sheets  
**Database:** User-owned Google Spreadsheet  
**Purpose:** Personal Digital Study Management
