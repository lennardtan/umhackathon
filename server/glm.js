// server/glm.js — Central GLM client for FinSight
// All three GLM calls live here. If GLM_API_KEY is missing, everything fails loudly.

const GLM_BASE_URL = 'https://api.ilmu.ai/v1/chat/completions';
const GLM_MODEL = 'ilmu-glm-5.1';

function requireApiKey() {
  const key = process.env.GLM_API_KEY;
  if (!key || key.trim() === '' || key === 'your_zhipu_api_key_here') {
    throw new Error('GLM_API_KEY is not configured. Set it in your .env file.');
  }
  return key;
}

async function callGLM(messages, { temperature = 0.3, max_tokens = 1024 } = {}, retries = 2) {
  const apiKey = requireApiKey();

  const body = { model: GLM_MODEL, messages, temperature, max_tokens };

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(GLM_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      // Retry on 5xx (server errors like 504 Gateway Timeout)
      if (response.status >= 500 && attempt < retries) {
        console.warn(`[GLM] Attempt ${attempt} failed with ${response.status}, retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      throw new Error(`GLM API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    // Strip markdown code fences if model wraps JSON in ```json ... ```
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return content;
  }
}

// --- GLM Call A: Parse & Categorise ---
// Triggered by POST /api/transactions and POST /api/transactions/upload
// Input:  [{ date, description, amount }]
// Output: [{ date, description, amount, type: 'income'|'expense', category }]
export async function categoriseWithGLM(rawRows) {
  const systemPrompt = `You are a financial transaction categoriser for a small business owner.
Given a list of transactions, classify each one.

For "type": use "income" if the transaction represents money received (sales, revenue, payments in).
Otherwise use "expense".

For "category", choose exactly one from:
- Salary
- Rent
- Utilities
- Marketing
- Inventory
- Transport
- Revenue (use this for income-type transactions)
- Miscellaneous

Respond ONLY with a JSON object containing a single key "transactions" whose value is an array.
Each element must have exactly: { "date": string, "description": string, "amount": number, "type": "income"|"expense", "category": string }
Do not include any explanation outside the JSON.`;

  const userContent = `Categorise these transactions:\n${JSON.stringify(rawRows, null, 2)}`;

  const content = await callGLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    { temperature: 0.2, max_tokens: 1500, json_mode: true }
  );

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`GLM returned invalid JSON for categorisation: ${content}`);
  }

  if (!Array.isArray(parsed.transactions)) {
    throw new Error(`GLM categorisation response missing "transactions" array.`);
  }

  return parsed.transactions;
}

// --- GLM Call B: Recommendations + Forecast Narrative ---
// Triggered by GET /api/analytics (userMessage=null) and POST /api/chat (userMessage=string)
// Input:  financialContext { summary, trendData, categoryData, mathForecast } + optional userMessage
// Output: { forecast: { scenario_warning }, recommendations: [{ issue, reasoning, action }], chat_reply }
export async function getRecommendationsAndForecast(financialContext, userMessage = null, chatHistory = []) {
  const systemPrompt = `You are FinSight, an AI financial advisor for a single-business owner.
You will receive financial data and must provide:
1. A "scenario_warning": a 1-2 sentence forward-looking risk warning based on trends.
2. "recommendations": an array of 3-5 actionable items, each with "issue", "reasoning", and "action".
3. If a user message is provided, a "chat_reply" responding conversationally to the user's specific question.

Respond ONLY with a JSON object with this exact structure:
{
  "forecast": {
    "scenario_warning": "string"
  },
  "recommendations": [
    { "issue": "string", "reasoning": "string", "action": "string" }
  ],
  "chat_reply": "string or null"
}`;

  const contextSummary = `
Financial Summary:
- Total Revenue: $${financialContext.summary.totalRevenue}
- Total Expenses: $${financialContext.summary.totalExpenses}
- Net Profit: $${financialContext.summary.netProfit}

Monthly Trend (last ${financialContext.trendData.length} months):
${financialContext.trendData.map(t => `  ${t.month}: Revenue $${Number(t.revenue).toFixed(2)}, Expenses $${Number(t.expenses).toFixed(2)}`).join('\n')}

Category Breakdown:
${financialContext.categoryData.map(c => `  ${c.category}: $${Number(c.amount).toFixed(2)}`).join('\n')}

Math-Based Forecast (next month):
- Predicted Revenue: $${financialContext.mathForecast.predictedRevenue}
- Predicted Expenses: $${financialContext.mathForecast.predictedExpenses}
- Expected Profit: $${financialContext.mathForecast.expectedProfit}
- Runway: ${financialContext.mathForecast.runwayMonths ?? 'N/A (currently profitable)'} months
`;

  const userContent = userMessage
    ? `${contextSummary}\n\nUser's question: ${userMessage}`
    : `${contextSummary}\n\nNo specific user question — provide general financial analysis.`;

  // Inject last N turns of conversation history for memory
  const historyMessages = chatHistory.slice(-6).map(m => ({ role: m.role, content: m.content }));

  const content = await callGLM(
    [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userContent },
    ],
    { temperature: 0.7, max_tokens: 3000, json_mode: true }
  );

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`GLM returned invalid JSON for recommendations: ${content}`);
  }

  return {
    forecast: parsed.forecast ?? { scenario_warning: 'Unable to generate scenario warning.' },
    recommendations: parsed.recommendations ?? [],
    chat_reply: parsed.chat_reply ?? null,
  };
}

// --- GLM Call C: Full Financial Report ---
// Triggered by GET /api/report
// Input:  financialContext + glmBOutput (from getRecommendationsAndForecast)
// Output: { summary: { revenue, expenses, profit }, issues: string[], recommendations: string[], outcomes: string }
export async function generateReport(financialContext, glmBOutput) {
  const systemPrompt = `You are FinSight, generating an executive financial report for a small business owner.
Using the provided financial data and AI analysis, produce a formal structured report.

Respond ONLY with a JSON object with this exact structure:
{
  "summary": {
    "revenue": number,
    "expenses": number,
    "profit": number
  },
  "issues": ["string", "string"],
  "recommendations": ["string", "string"],
  "outcomes": "string"
}

Rules:
- "issues": 3-5 specific problems identified from the data (plain strings, no object nesting)
- "recommendations": 3-5 concrete action items written as plain strings
- "outcomes": 2-3 sentences describing the projected impact if recommendations are followed
- "summary" numbers should reflect the provided totals`;

  const reportContext = `
Financial Data Summary:
${JSON.stringify(financialContext.summary, null, 2)}

Monthly Trend Data:
${JSON.stringify(financialContext.trendData, null, 2)}

Category Breakdown:
${JSON.stringify(financialContext.categoryData, null, 2)}

Scenario Warning (from AI analysis):
${glmBOutput.forecast.scenario_warning}

Prior Recommendations to expand into formal report format:
${glmBOutput.recommendations.map((r, i) => `${i + 1}. Issue: ${r.issue} | Action: ${r.action}`).join('\n')}
`;

  const content = await callGLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: reportContext },
    ],
    { temperature: 0.3, max_tokens: 3000, json_mode: true }
  );

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`GLM returned invalid JSON for report: ${content}`);
  }

  // Always use actual DB values for summary numbers — never trust GLM hallucinations here
  return {
    summary: {
      revenue: financialContext.summary.totalRevenue,
      expenses: financialContext.summary.totalExpenses,
      profit: financialContext.summary.netProfit,
    },
    issues: Array.isArray(parsed.issues) ? parsed.issues : ['Unable to identify issues.'],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    outcomes: typeof parsed.outcomes === 'string' ? parsed.outcomes : 'No forecast available.',
  };
}
