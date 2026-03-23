# Little Steps Registry

A smart, AI-powered baby registry application built with React, Vite, Tailwind CSS, Firebase, and Google's Gemini API.

## Features
- **Smart Gift Recommender:** Uses Gemini AI to analyze the registry, due date, and season to suggest missing essential items.
- **Link Scraping:** Automatically fetches product titles and images when pasting links from stores like Takealot or Amazon.

---

## 💻 Local Development Setup

### 1. Install Dependencies
Make sure you have Node.js installed, then run:
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the root of the project and add your API keys. 

```env
# Required for the AI Smart Recommender
GEMINI_API_KEY=your_gemini_api_key_here
```
*Note: Never commit your `.env` file to version control.*

### 3. Run the Development Server
This project uses a custom Express server (`server.ts`) alongside Vite to handle backend API routes.
```bash
npm run dev
```
Your app will be running at `http://localhost:3000`.

---

## 🚀 Deploying to Render (Recommended for Full-Stack)

Because this app uses a Node.js backend (`server.ts`) for features like **Link Scraping**, deploying to a full-stack host like Render is recommended.

### Step 1: Connect your Repository
1. Push your code to a GitHub repository.
2. Log in to [Render.com](https://render.com) and create a new **Web Service**.
3. Connect your GitHub repository.

### Step 2: Configure Build & Run Commands
- **Build Command:** `npm run build`
- **Start Command:** `npm run start`

### Step 3: Add Environment Variables (Crucial for AI)
Render does not see your local `.env` file. You must add your API keys directly in the Render dashboard so Vite can bake them into your frontend during the build:
1. In your Render Web Service dashboard, go to **Environment**.
2. Click **Add Environment Variable**.
3. Key: `GEMINI_API_KEY` | Value: `your_actual_api_key_here`
4. Click **Save Changes**.

### Step 4: Clear Cache and Deploy
If you added or changed environment variables *after* your first deployment, you must force Vite to rebuild the app:
1. Click the **Manual Deploy** button in the top right of your Render dashboard.
2. Select **Clear build cache & deploy**.
3. Once the deployment finishes, your Smart Gift Recommender will work perfectly!

---

## 🚀 Deploying to Firebase Hosting (Frontend Only)

If you prefer to deploy to the free Firebase Spark plan, note that **backend features like Link Scraping will not work**. Firebase Hosting only serves static frontend files.

### Step 1: Login & Initialize
```bash
npx firebase-tools login
npx firebase-tools init hosting
```
Answer the prompts:
1. **Are you ready to proceed?** `Y`
2. **Please select an option:** `Use an existing project`
3. **What do you want to use as your public directory?** `dist` *(Crucial: Do not use 'public')*
4. **Configure as a single-page app?** `y`
5. **Set up automatic builds and deploys with GitHub?** `N`
6. **File dist/index.html already exists. Overwrite?** `N`

### Step 2: Build and Deploy
```bash
npm run build
npx firebase-tools deploy --only hosting
```

---

## 🔒 Security: Protecting your Gemini API Key
Because the Gemini API key is baked into the frontend code, it is visible to anyone inspecting your website. To prevent abuse:

1. Go to the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2. Select your Google Cloud project.
3. Click on your Gemini API Key to edit it.
4. Under **Application restrictions**, select **HTTP referrers (web sites)**.
5. Click **Add an item** and add your live domains (e.g., `https://little-steps-registry.onrender.com/*` or `https://your-app.web.app/*`).
6. Click **Save**.

Now, Google will block any requests using your key that don't originate from your specific website.
