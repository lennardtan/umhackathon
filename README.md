# 💡 FinSight — AI-Powered Business Expense Optimisation

> Built for **UMHackathon 2026** — Domain 2: AI for Economic Empowerment & Decision Intelligence

FinSight is an AI-powered financial decision intelligence system designed for small business owners. It helps users understand where their money is going, forecast what's coming, and get actionable recommendations — all powered by **Z.AI's GLM model**.

---

## 🚀 Features

| Feature | Description |
|---|---|
| 📤 Data Input | Upload CSV or manually enter transactions (income & expenses) |
| 🏷️ AI Categorisation | GLM automatically categorises transactions (Salary, Rent, Utilities, Marketing, etc.) |
| 📊 Financial Analysis | Instant summary of total income, expenses, and net profit |
| 📈 Forecasting | GLM predicts next-month revenue, expenses, profit, and runway |
| 🤖 AI Recommendations | Chat with your AI financial advisor — ask anything about your finances |
| 📄 AI Financial Report | One-click generation of a full structured financial report |

---

## 🧠 How GLM Powers the System

FinSight makes **3 core GLM API calls** — removing any one of them breaks the system:

```
GLM Call A  →  Parse raw CSV + auto-categorise transactions
GLM Call B  →  Generate financial forecast + actionable recommendations  
GLM Call C  →  Produce full structured AI financial report
```

GLM is not an add-on — it is the engine. Without it, no data gets categorised, no forecast is generated, and no recommendations or reports are produced.

---

## 🗂️ Pages

### 1. Cashflow Page (`/`)
- Upload CSV or add transactions manually
- GLM parses and categorises each transaction automatically
- Users can override any category manually
- Summary cards: Total Income, Total Expenses, Net Profit
- Transactions table with predicted categories

### 2. Analytics Page (`/analytics`)
- Revenue vs Expenses chart (6 months)
- Category breakdown chart
- GLM-powered forecast: predicted next-month figures
- Trend signals per category (rising/falling)
- Scenario warning: e.g. "If current trend continues, profit drops below 20% by July"

### 3. AI Assistant Page (`/chat`)
- Chat interface powered by GLM
- Ask natural language questions: "Why is my profit dropping?", "Where should I cut costs?"
- Paste unstructured business notes for GLM to factor in
- Click **Generate Report** to trigger a full AI financial report
- Reports rendered inline and available for download

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)           │
│         Cashflow │ Analytics │ Chat │ Report         │
└────────────────────────┬────────────────────────────┘
                         │ /api proxy
┌────────────────────────▼────────────────────────────┐
│              Backend (Node.js + Express)             │
│   /transactions │ /analytics │ /chat │ /report       │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼──────────────┐
│   Supabase (DB)     │   │     Z.AI GLM API         │
│  transactions       │   │  Call A: Parse + Tag      │
│  chat_history       │   │  Call B: Forecast + Recs  │
│  monthly_summary    │   │  Call C: Full Report      │
│  reports            │   └──────────────────────────┘
└─────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| AI Model | Z.AI GLM (mandatory — central to system) |
| CSV Parsing | multer + csv-parser |
| Styling | Tailwind CSS |

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js v18+
- Supabase account + project
- Z.AI GLM API key

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/finsight.git
cd finsight
```

### 2. Install frontend dependencies
```bash
npm install
```

### 3. Install backend dependencies
```bash
cd server
npm install
```

### 4. Set up environment variables

Create a `.env` file in the `server/` directory:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
GLM_API_KEY=your_zai_glm_api_key
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
PORT=3001
```

### 5. Set up Supabase tables

Run the following in your Supabase SQL editor:

```sql
-- Transactions
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')),
  category TEXT,
  source TEXT CHECK (source IN ('csv', 'manual')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chat history
CREATE TABLE chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT CHECK (role IN ('user', 'assistant')),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Monthly summary
CREATE TABLE monthly_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER,
  year INTEGER,
  total_income NUMERIC,
  total_expenses NUMERIC,
  net_profit NUMERIC,
  top_category TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  summary TEXT,
  key_issues TEXT,
  recommended_actions TEXT,
  forecast_outlook TEXT,
  explanation TEXT,
  generated_at TIMESTAMP DEFAULT NOW()
);
```

### 6. Run the backend
```bash
cd server
node index.js
```

### 7. Run the frontend
```bash
# From root directory
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:3001`.

---

## 📁 Project Structure

```
finsight/
├── src/                        # React frontend
│   ├── pages/
│   │   ├── Cashflow.tsx        # Expenses & Cashflow page
│   │   ├── Analytics.tsx       # Financial Analytics page
│   │   ├── Chat.tsx            # AI Assistant page
│   │   └── Report.tsx          # AI Report page
│   └── components/
├── server/                     # Express backend
│   ├── index.js                # Main server entry
│   ├── categorisation.js       # GLM Call A — parse + categorise
│   ├── glm.js                  # GLM API wrapper (all 3 calls)
│   └── routes/
│       ├── transactions.js
│       ├── analytics.js
│       ├── chat.js
│       └── report.js
├── .env                        # Environment variables (not committed)
├── README.md
└── package.json
```

---

## 👥 Team

| Name | Role |
|---|---|
| Guan Ee | Frontend Engineer |
| Lok Qi | AI Engineer (GLM integration) |
| Wai Hong | Backend Engineer |
| Chun Kit | Backend Engineer |
| Chee Cheng | Backend Engineer |

---

## 🏆 Hackathon

**Event:** UMHackathon 2026
**Organiser:** Persatuan Komputer Universiti Malaya (PEKOM)
**Domain:** Domain 2 — AI for Economic Empowerment & Decision Intelligence
**Team:** FinSight

> ⚠️ This project uses Z.AI's GLM model exclusively as required by UMHackathon 2026 rules. Using any other reasoning model is not permitted.

---

*© FinSight Team — UMHackathon 2026*
