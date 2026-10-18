# QuestEd

Gamified learning platform for college students

## Team Byteforce

| Role | Name |
| --- | --- |
| Team Leader | Pratishtha Keshri |
| Member 1 | Divyanshu Jha |
| Member 2 | Chandra Sekhar Swain |
| Member 3 | Aryan Yadav |

Class project submission · 18 October 2026

## Project overview

QuestEd connects student learning with faculty coursework. Students complete subject quizzes and assignments, while faculty publish work and monitor submissions. XP, streaks, badges and leaderboards make participation visible and encourage regular practice.

This document explains the current prototype, the three connected websites, its implementation, and a suggested demonstration. It distinguishes existing behavior from improvements that would need additional development. The project has not yet established measured learning gains or production scale.

## Problem and intended users

Students can find it difficult to maintain regular practice and see their progress across subjects. Faculty need a consistent way to publish activities, find student submissions and review completed work. These are the design problems QuestEd addresses, rather than conclusions from a formal user study.

| User | Main tasks |
| --- | --- |
| Student | Complete subject challenges, submit assignments and view earned progress. |
| Faculty | Track registered students and review coursework for the assigned subject. |
| Faculty publisher | Create assignments and scheduled quizzes using the same faculty account. |

## Three connected websites

The student site hosts the shared backend and database. The faculty dashboard and QuestEd Studio use server routes to access it with an authenticated faculty session. This keeps published work and student activity in one source of truth.

## Features and subject coverage

### Student experience

Students activate an approved Mains ID using an individual activation code, create a password, and sign in. The demo student ID is 11111, with MAINS-11111 accepted as an alias. Activation codes and passwords are deliberately omitted from this shareable document.

The student interface provides separate quizzes for each subject, daily challenges, assignment responses, quiz history, XP, streaks, badges, leagues and campus team battles. Profile customization, dark mode and responsive layouts support use across browser sizes.

### Faculty dashboard

Faculty sign in using their own five digit faculty ID. They can view registered students, quiz activity, published coursework and assignment submissions. Accepting an assignment awards verified XP. The Publish assignment and Publish quiz actions open QuestEd Studio.

### QuestEd Studio

Faculty use the same ID and password to sign in separately to Studio. They publish assignments with instructions and a due date, or prepare subject quizzes for a chosen date. The quiz editor has no fixed question count cap, although normal request size limits still apply. Published work appears in the shared student and faculty data.

| Subject | Faculty |
| --- | --- |
| DSA | Nishant Singh |
| Web Development | Deepika Bhansali |
| English and Communication Skills | Ms Soni Vijayvargiya |
| Maths | Keshav Gupta |
| Chemistry | Anil Sharma |
| Constitutional Design | Shivani Rathore |

### Quiz and reward rules

The server scores each quiz and records XP against its subject. A student receives one scored attempt per subject per day. Published faculty challenges replace automatic practice for the selected subject and date. The questions and scoring rules are captured when an attempt starts, so later changes cannot alter that attempt.

## Technical implementation

| Layer | Technology and role |
| --- | --- |
| Languages | TypeScript for application logic, HTML and CSS for the interface, SQL for persistent records. |
| Frontend | React with Vinext, responsive CSS and CSS based 3D decoration. |
| Backend | Server API routes running on Cloudflare Workers. |
| Database | Cloudflare D1, a managed database with SQLite semantics. |
| Schema tools | Drizzle ORM schema definitions and SQL migration files. |
| Authentication | Custom approved ID activation, password hashing and server sessions. |
| Hosting and tools | Sites deployment workflow and Git for source version control. |
| Validation | Node based tests, SQLite integration checks and Python database checks. |

The current application uses Cloudflare D1. Supabase is not the active database for this implementation. Faculty and Studio do not maintain independent copies of student records.

## API responsibilities

The student authentication API handles activation, sign in and sign out. The student learning API serves dashboards, quizzes, responses and progress. Separate faculty authentication and faculty APIs enforce staff permissions and process publishing and review actions.

The faculty dashboard and Studio proxy requests from their servers to the shared backend. Raw faculty session tokens do not enter page URLs or browser storage. Each website uses its own secure session cookie, so faculty may need to sign in again when opening Studio.

## Database records

The main records are people, questions, attempts, assignments, submissions, daily challenges and XP events. Separate credential and session tables protect student and faculty accounts. Configuration, audit entries and rate limit records support operations. Unique database constraints prevent repeated awards and duplicate daily attempts.

## Workflow and access controls

### Publishing an assignment

1. Faculty signs in to the faculty dashboard and selects Publish assignment.
2. Studio opens and asks for the faculty account if no Studio session exists.
3. Faculty enters a title, instructions, subject and due date, then publishes.
4. The shared backend saves the assignment. Students can open it and submit a response.
5. Faculty reviews the response on the faculty dashboard and accepts it to award XP.

### Publishing a subject quiz

1. Faculty opens Publish quiz and chooses the challenge date in India time.
2. Faculty enters the question prompts, four options, correct answers and explanations.
3. Studio sends the challenge to the shared backend. The challenge remains fixed after publication.
4. On the chosen date, students receive that challenge in the relevant subject.
5. The server scores answers, records the attempt and updates subject XP.

A subject can have one published challenge per date. Faculty must publish before a student starts that subject quiz for the date. If a conflict occurs, choose another date. Question count is flexible, but the API rejects a request that exceeds its payload size limit.

## Security measures

The backend validates approved IDs and subject permissions. Student sessions cannot call faculty publishing routes. Ordinary faculty manage their assigned subject, while the explicit faculty demo account supports demonstration across subjects.

Passwords use salted PBKDF2 hashing. The database stores session token hashes, and browser cookies use HttpOnly, Secure and SameSite settings. Origin checks and request limits reduce unauthorized cross site writes and repeated login attempts. Correct quiz answers remain hidden from students until submission.

These measures support a controlled prototype. They do not replace an independent security audit, operational monitoring, backup planning or further load testing before wider institutional rollout.

## Validation and demonstration

Development checks cover activation and sessions, student and faculty isolation, subject permissions, shared assignment review, quiz scoring, attempt snapshots, badges, duplicate reward prevention and request throttling. Integration checks also exercised Studio publishing against the backend handlers and shared database. Production builds and deployment checks passed during development. Visual browser testing has not been completed in the available environment.

### Suggested demonstration

First open Studio as faculty and publish a short assignment. Open the student website as student demo and submit a response. Return to the faculty dashboard, refresh the coursework list, review the submission and show the updated student XP. Then show the subject quiz editor and the student progress page. Use approved demo credentials privately.

## Live websites

[Student website](https://quested.glassysole8.chatgpt.site)

[Faculty dashboard](https://quested-faculty.glassysole8.chatgpt.site)

[QuestEd Studio](https://quested-studio.glassysole8.chatgpt.site)

## Known limits and future development

Login requires an approved account and a password. Password recovery currently requires administrator assistance. Cross site updates rely on refresh and periodic polling rather than a live socket connection. Assignment responses currently accept text, including project links, rather than a dedicated file upload workflow.

Possible next steps include self service password recovery, attachment uploads, notifications and broader browser and device testing. These are planned improvements, not claims about existing functionality.

## Source layout

```text
student/       Student frontend, shared backend and D1 database migrations
faculty/       Faculty tracking and review website
studio/        Faculty assignment and quiz publishing website
scripts/       Local sample-account and URL configuration helpers
```

The public source contains sample identities only. Real student rosters, production activation hashes, session data and hosting project IDs are excluded. Generate fresh activation codes for your own local copy. The supplied ZIP contains source code, not the production database or an already configured deployment.

## Local setup

Requirements: Node.js 22.13 or newer, pnpm 11.25.0, and Python 3 for database regression tests. Each application has its own package.json and lockfile. Install dependencies separately in each folder.

1. Extract this project and open a terminal in the top-level folder.
2. Run `node scripts/create-demo-accounts.mjs` once. Your unique activation codes appear in the ignored `private/activation-codes.json` file. Never upload that file.
3. Start the student application in terminal 1:

```bash
cd student
pnpm install --frozen-lockfile
pnpm run setup
```

The setup command builds the app, applies its SQL migrations to local D1 storage, and starts development. The default student origin is `http://localhost:5173`.

4. Start the faculty website in terminal 2, from the project root:

```bash
cd faculty
pnpm install --frozen-lockfile
pnpm run dev --port 5174
```

5. Start Studio in terminal 3, from the project root:

```bash
cd studio
pnpm install --frozen-lockfile
pnpm run dev --port 5175
```

Use the same hostname, `localhost`, for all three apps. The student service must be running because it owns the shared backend. Local and production records remain separate. Session cookies require a secure context; if your browser rejects secure cookies over localhost HTTP, use HTTPS for the local origins or deploy to HTTPS before testing login.

Activate sample student `11111` and sample faculty `22222` using the separately generated codes. Create a password of 10 to 128 characters during activation. Both faculty websites use the same backend credentials, with separate browser cookies. Sample IDs 48219 and 36475 demonstrate subject-restricted faculty access. The sample identity names in the generated roster are distinct from the real course faculty displayed in the product.

## Changing website addresses

From the project root, run the following command with your own deployed HTTPS origins. The example domains are placeholders.

```bash
node scripts/configure-urls.mjs --student https://student.example.com --faculty https://faculty.example.com --studio https://studio.example.com
```

This updates navigation links and the faculty/Studio server proxy target. Rebuild all affected apps afterwards. Production defaults are deliberately replaced with localhost origins in this public source package so a new clone cannot accidentally publish work into the existing live database.

## Checks

Inside each app, run:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

The student tests exercise real API handlers against an isolated SQLite database. Studio includes a backend fixture for publishing integration tests. Test fixtures use synthetic accounts and do not connect to the live database. After changing student backend behavior, update the matching Studio test fixture when needed.

## Hosting

These are server applications that use Cloudflare Workers and Cloudflare D1. GitHub hosts the repository, but GitHub Pages alone cannot run the API routes or database. Creating a GitHub repository does not automatically deploy the apps or modify the existing live websites.

For a new deployment, create three application deployments and one D1 database owned by the student backend. Configure the student Worker with its DB binding, apply the SQL files in student/drizzle in order, and configure the two server proxies to target the deployed student origin. Keep the same routing, assets and Worker configuration generated by the Vinext build. The .openai/hosting.json files retain the binding declarations but omit existing Site project IDs. A new Sites deployment must be registered separately; direct Cloudflare deployment requires your own account and deployment configuration.

## Uploading to GitHub

1. Create a new public GitHub repository.
2. Extract the ZIP and upload the contents of the QuestEd_ByteForce folder, keeping the student, faculty and studio subfolders.
3. Include this root README.md and the .gitignore files. Do not upload private, node_modules, dist, .wrangler, .env files or your local database.
4. Once uploaded, share the repository URL with your CR. This package does not create or claim an existing GitHub repository.

For a local Git installation, initialize and commit the extracted source before adding your own GitHub remote. The source package does not include Git history or repository credentials.
