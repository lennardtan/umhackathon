import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Target, BrainCircuit } from "lucide-react";

// Module-level cache — survives page navigation within the SPA
let _analyticsCache: any = null;

export default function Analytics() {
  const [data, setData] = useState(_analyticsCache || {
    trendData: [],
    categoryData: [],
    forecast: {
      predictedRevenue: 0,
      predictedExpenses: 0,
      expectedProfit: 0,
      runwayMonths: null,
      scenario_warning: 'Loading AI analysis...'
    }
  });

  useEffect(() => {
    if (_analyticsCache) return; // already loaded
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/analytics');
        const json = await res.json();
        _analyticsCache = json;
        setData(json);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAnalytics();
  }, []);

  const trendData = data.trendData ?? [];
  const categoryData = data.categoryData ?? [];
  const forecast = data.forecast ?? {
    predictedRevenue: 0, predictedExpenses: 0, expectedProfit: 0,
    runwayMonths: null, scenario_warning: data.error ?? 'Loading AI analysis...'
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-6 pt-28 pb-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Financial Analytics</h1>
          <p className="text-muted-foreground">Visualize your data, identify trends, and view AI-powered forecasts.</p>
        </div>

        {/* GLM-4 Forecast Section */}
        <div className="bg-gradient-secondary border border-primary/30 rounded-xl p-6 mb-8 shadow-glow-lg flex flex-col md:flex-row gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
             <BrainCircuit className="w-48 h-48 text-primary" />
          </div>
          
          <div className="md:w-1/3 relative z-10">
            <div className="flex items-center space-x-2 mb-4">
              <BrainCircuit className="text-primary w-6 h-6" />
              <h2 className="text-xl font-bold font-sans">GLM-4 Forecast</h2>
            </div>
            <p className="text-muted-foreground mb-4">Based on your last 6 months of historical data, here is your projected runway and next month's forecast.</p>
            
            <div className="bg-background/50 rounded-lg p-4 border border-border mt-auto">
              <h4 className="text-sm font-semibold text-primary mb-1">Scenario Warning</h4>
              <p className="text-sm">{forecast.scenario_warning}</p>
            </div>
          </div>
          
          <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              <span className="text-sm text-muted-foreground">Predicted Revenue (Next Month)</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">${forecast.predictedRevenue.toFixed(2)}</div>
              <div className="flex items-center mt-2 text-xs text-emerald-500">
                <TrendingUp className="w-3 h-3 mr-1" /> Based on 3-month avg
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              <span className="text-sm text-muted-foreground">Predicted Expenses (Next Month)</span>
              <div className="text-2xl font-bold text-destructive mt-1">${forecast.predictedExpenses.toFixed(2)}</div>
              <div className="flex items-center mt-2 text-xs text-destructive">
                <TrendingUp className="w-3 h-3 mr-1" /> Based on 3-month avg
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              <span className="text-sm text-muted-foreground">Expected Profit (Next Month)</span>
              <div className="text-2xl font-bold text-primary mt-1">${forecast.expectedProfit.toFixed(2)}</div>
              <div className="flex items-center mt-2 text-xs text-primary">
                 Calculated Forecast
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              <span className="text-sm text-muted-foreground">Target Runway</span>
              <div className="text-2xl font-bold text-foreground mt-1">{forecast.runwayMonths == null ? 'Profitable ✓' : forecast.runwayMonths > 120 ? 'Infinite' : `${forecast.runwayMonths.toFixed(1)} Months`}</div>
              <div className="flex items-center mt-2 text-xs text-muted-foreground">
                <Target className="w-3 h-3 mr-1" /> Based on current burn
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Revenue vs Expenses Line Chart */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-card">
            <h3 className="text-lg font-bold mb-6">Revenue vs Expenses (6 Months)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="month" stroke="#888" tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f1f23', border: '1px solid #333', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#34d399" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f87171" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breakdown Bar Chart */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Category Breakdown (This Month)</h3>
              <div className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                Utilities increasing MoM
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#888" tickLine={false} axisLine={false} />
                  <YAxis dataKey="category" type="category" stroke="#888" tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#333', opacity: 0.2 }}
                    contentStyle={{ backgroundColor: '#1f1f23', border: '1px solid #333', borderRadius: '8px' }}
                  />
                  <Bar dataKey="amount" name="Amount ($)" fill="#9333ea" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
