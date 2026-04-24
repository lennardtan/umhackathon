import dotenv from 'dotenv';
import { fileURLToPath as _ftu } from 'url';
import { dirname as _dn, join as _jn } from 'path';
dotenv.config({ path: _jn(_dn(_ftu(import.meta.url)), '..', '.env') }); // load .env from project root
const _key = process.env.GLM_API_KEY;
console.log('[ENV] GLM_API_KEY loaded:', _key ? `${_key.substring(0, 8)}...` : 'NOT FOUND');
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import db from './db.js';
import { categoriseWithGLM, getRecommendationsAndForecast, generateReport } from './glm.js';
import { loadChatHistory, saveChatMessages, loadLatestReport, saveReport, loadSupabaseTransactions } from './supabase.js';

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// --- Shared helper: build financial context from DB + Supabase ---
async function buildFinancialContext() {
  const getMonthKey = (date) => {
    if (!date) return null;
    if (date.includes('/')) {
      const parts = date.split('/');
      if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}`;
    }
    if (date.includes('-')) return date.substring(0, 7);
    return null;
  };

  // Fetch all data sources first
  const [supabaseTxs, localTransactions, localCats] = await Promise.all([
    loadSupabaseTransactions(),
    Promise.resolve(db.prepare(`SELECT Order_Date, Sales, type FROM transactions`).all()),
    Promise.resolve(db.prepare(`SELECT Category as category, SUM(Sales) as amount FROM transactions GROUP BY Category ORDER BY amount DESC`).all()),
  ]);

  // Category breakdown: merge local SQLite + Supabase UM Hackathon
  const supabaseCatMap = {};
  supabaseTxs.forEach(tx => {
    const cat = tx.Category || 'Uncategorised';
    supabaseCatMap[cat] = (supabaseCatMap[cat] || 0) + tx.Sales;
  });
  const mergedCatMap = {};
  localCats.forEach(r => { mergedCatMap[r.category] = (mergedCatMap[r.category] || 0) + r.amount; });
  Object.entries(supabaseCatMap).forEach(([cat, amt]) => { mergedCatMap[cat] = (mergedCatMap[cat] || 0) + amt; });
  const categoryData = Object.entries(mergedCatMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  let totalRevenue = 0;
  let totalExpenses = 0;
  const monthMap = {};

  // Supabase UM Hackathon rows = revenue (sales data)
  supabaseTxs.forEach(tx => {
    const month = getMonthKey(tx.Order_Date);
    if (!month) return;
    if (!monthMap[month]) monthMap[month] = { month, revenue: 0, expenses: 0 };
    totalRevenue += tx.Sales;
    monthMap[month].revenue += tx.Sales;
  });

  // Local SQLite = manually added income/expenses
  localTransactions.forEach(tx => {
    const month = getMonthKey(tx.Order_Date);
    if (!month) return;
    if (!monthMap[month]) monthMap[month] = { month, revenue: 0, expenses: 0 };
    if (tx.type === 'income') {
      totalRevenue += tx.Sales;
      monthMap[month].revenue += tx.Sales;
    } else {
      totalExpenses += tx.Sales;
      monthMap[month].expenses += tx.Sales;
    }
  });

  const trendData = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

  // Weighted moving average forecast (last 4 months)
  let predictedRevenue = 0;
  let predictedExpenses = 0;

  if (trendData.length > 0) {
    const recent = trendData.slice(-4);
    let weightSum = 0, revSum = 0, expSum = 0;
    recent.forEach((t, i) => {
      const weight = i + 1;
      weightSum += weight;
      revSum += t.revenue * weight;
      expSum += t.expenses * weight;
    });
    predictedRevenue = revSum / weightSum;
    predictedExpenses = expSum / weightSum;
  }

  const expectedProfit = predictedRevenue - predictedExpenses;
  const runwayMonths = expectedProfit < 0 ? 50000 / Math.abs(expectedProfit) : null;
  const round = (n) => Number(n.toFixed(2));

  return {
    summary: {
      totalRevenue: round(totalRevenue),
      totalExpenses: round(totalExpenses),
      netProfit: round(totalRevenue - totalExpenses),
    },
    trendData,
    categoryData,
    mathForecast: {
      predictedRevenue: round(predictedRevenue),
      predictedExpenses: round(predictedExpenses),
      expectedProfit: round(expectedProfit),
      runwayMonths: runwayMonths ? round(runwayMonths) : null,
    },
  };
}

// --- 1. Data Input & Categorisation ---

// Get all transactions (local SQLite manual entries + Supabase UM Hackathon)
app.get('/api/transactions', async (req, res) => {
  try {
    const local = db.prepare('SELECT * FROM transactions ORDER BY Row_ID DESC LIMIT 1000').all();
    const supabaseTxs = await loadSupabaseTransactions();
    const supabaseRows = supabaseTxs.map((tx, i) => ({
      Row_ID: `SB-${i}`,
      Order_ID: tx.Order_ID || '',
      Order_Date: tx.Order_Date,
      Product_Name: tx.Product_Name || tx.Sub_Category || tx.Category || 'Sale',
      Sales: tx.Sales,
      Category: tx.Category || 'Revenue',
      type: 'income',
    }));
    res.json([...local, ...supabaseRows]);
  } catch (err) {
    console.error('GET /api/transactions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add a single manual transaction — GLM Call A categorises it
app.post('/api/transactions', async (req, res) => {
  try {
    const { Order_Date, Product_Name, Sales, Category, type } = req.body;

    let finalCategory = Category;
    let finalType = type || 'expense';

    // Call GLM if category is not provided or is the "auto" sentinel
    if (!finalCategory || finalCategory === 'Other' || finalCategory === 'Auto') {
      const glmResults = await categoriseWithGLM([{
        date: Order_Date,
        description: Product_Name,
        amount: parseFloat(Sales) || 0,
      }]);
      finalCategory = glmResults[0]?.category || 'Miscellaneous';
      finalType = glmResults[0]?.type || finalType;
    }

    const Order_ID = `MANUAL-${Date.now()}`;
    const stmt = db.prepare(
      'INSERT INTO transactions (Order_ID, Order_Date, Product_Name, Sales, Category, type) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(Order_ID, Order_Date, Product_Name, parseFloat(Sales) || 0, finalCategory, finalType);

    invalidateGLMCache();
    res.json({
      Row_ID: result.lastInsertRowid,
      Order_Date,
      Product_Name,
      Sales: parseFloat(Sales) || 0,
      Category: finalCategory,
      type: finalType,
    });
  } catch (err) {
    console.error('POST /api/transactions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Upload CSV — GLM Call A categorises uncategorised rows in bulk
app.post('/api/transactions/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const rawRows = [];
  const stream = Readable.from(req.file.buffer.toString());

  stream
    .pipe(csvParser())
    .on('data', (data) => {
      const Order_ID = data['Order_ID'] || data['order_id'] || `CSV-${Date.now()}-${Math.random()}`;
      const Order_Date = data['Order_Date'] || data['date'] || data['Date'] || '';
      const Product_Name = data['Product_Name'] || data['description'] || data['Description'] || 'Unknown';
      const Sales = parseFloat(data['Sales'] || data['amount'] || data['Amount'] || '0') || 0;
      const existingCategory = data['Category'] || data['category'] || null;
      const existingType = data['type'] || data['Type'] || null;

      rawRows.push({ Order_ID, Order_Date, Product_Name, Sales, existingCategory, existingType });
    })
    .on('end', async () => {
      try {
        const needsGLM = rawRows.filter(r => !r.existingCategory || r.existingCategory === 'Other');
        const alreadyCategorised = rawRows.filter(r => r.existingCategory && r.existingCategory !== 'Other');

        let glmResults = [];
        if (needsGLM.length > 0) {
          glmResults = await categoriseWithGLM(
            needsGLM.map(r => ({ date: r.Order_Date, description: r.Product_Name, amount: r.Sales }))
          );
        }

        let glmIdx = 0;
        const finalRows = rawRows.map(r => {
          if (!r.existingCategory || r.existingCategory === 'Other') {
            const glmRow = glmResults[glmIdx++] || {};
            return { ...r, Category: glmRow.category || 'Miscellaneous', type: glmRow.type || 'expense' };
          }
          return { ...r, Category: r.existingCategory, type: r.existingType || 'expense' };
        });

        const insert = db.prepare(
          'INSERT INTO transactions (Order_ID, Order_Date, Product_Name, Sales, Category, type) VALUES (?, ?, ?, ?, ?, ?)'
        );
        const insertMany = db.transaction((rows) => {
          for (const row of rows) {
            insert.run(row.Order_ID, row.Order_Date, row.Product_Name, row.Sales, row.Category, row.type);
          }
        });
        insertMany(finalRows);
        invalidateGLMCache();
        res.json({ message: `Successfully processed ${finalRows.length} transactions.` });
      } catch (err) {
        console.error('CSV upload GLM error:', err.message);
        res.status(500).json({ error: `GLM categorisation failed: ${err.message}` });
      }
    })
    .on('error', (err) => {
      res.status(500).json({ error: 'CSV parsing error: ' + err.message });
    });
});

// Update category manually
app.put('/api/transactions/:id', (req, res) => {
  const { category } = req.body;
  const stmt = db.prepare('UPDATE transactions SET Category = ? WHERE Row_ID = ?');
  stmt.run(category, req.params.id);
  invalidateGLMCache();
  res.json({ success: true });
});

// Delete a transaction
app.delete('/api/transactions/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM transactions WHERE Row_ID = ?');
  stmt.run(req.params.id);
  invalidateGLMCache();
  res.json({ success: true });
});

// --- In-memory GLM cache (invalidated on any data change) ---
let _analyticsCache = null;
let _reportCache = null;

function invalidateGLMCache() {
  _analyticsCache = null;
  _reportCache = null;
  console.log('[CACHE] GLM cache invalidated');
}

// --- 2. Financial Analysis & Forecasting ---

// Analytics: math-based data + GLM Call B narrative layer
app.get('/api/analytics', async (req, res) => {
  try {
    if (_analyticsCache) {
      console.log('[CACHE] Serving analytics from cache');
      return res.json(_analyticsCache);
    }
    const context = await buildFinancialContext();
    const glmOutput = await getRecommendationsAndForecast(context, null);

    _analyticsCache = {
      summary: context.summary,
      trendData: context.trendData,
      categoryData: context.categoryData,
      forecast: {
        predictedRevenue: context.mathForecast.predictedRevenue,
        predictedExpenses: context.mathForecast.predictedExpenses,
        expectedProfit: context.mathForecast.expectedProfit,
        runwayMonths: context.mathForecast.runwayMonths,
        scenario_warning: glmOutput.forecast.scenario_warning,
      },
      recommendations: glmOutput.recommendations,
    };
    res.json(_analyticsCache);
  } catch (err) {
    console.error('GET /api/analytics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 3 & 4. AI Recommendations & Report ---

// Chat: GLM Call B with user message + conversation history from Supabase
app.post('/api/chat', async (req, res) => {
  const { message, session_id = 'default' } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message field is required' });
  }

  try {
    const [context, history] = await Promise.all([
      buildFinancialContext(),
      loadChatHistory(session_id, 10),
    ]);

    const glmOutput = await getRecommendationsAndForecast(context, message, history);
    const isReport = message.toLowerCase().includes('report');
    const reply = glmOutput.chat_reply || 'I was unable to generate a response. Please try again.';

    // Save both turns to Supabase
    await saveChatMessages(session_id, [
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ]);

    res.json({ reply, isReport });
  } catch (err) {
    console.error('POST /api/chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Report: check Supabase first, then GLM Call B → GLM Call C
app.get('/api/report', async (req, res) => {
  try {
    // 1. In-memory cache (fastest)
    if (_reportCache) {
      console.log('[CACHE] Serving report from memory cache');
      return res.json(_reportCache);
    }
    // 2. Supabase persistent cache (survives server restart)
    const saved = await loadLatestReport();
    if (saved) {
      console.log('[SUPABASE] Serving report from Supabase');
      _reportCache = { summary: saved.summary, issues: saved.issues, recommendations: saved.recommendations, outcomes: saved.outcomes };
      return res.json(_reportCache);
    }
    // 3. Generate fresh report with GLM
    const context = await buildFinancialContext();
    const glmBOutput = await getRecommendationsAndForecast(context, null, []);
    const report = await generateReport(context, glmBOutput);

    _reportCache = report;
    await saveReport(report); // persist to Supabase
    res.json(_reportCache);
  } catch (err) {
    console.error('GET /api/report error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
