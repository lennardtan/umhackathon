import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, DollarSign, Upload, Plus, AlertCircle, X } from "lucide-react";

export default function Expenses() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalExpenses: 0, netProfit: 0 });
  const [topCostDriver, setTopCostDriver] = useState<{ category: string; amount: number; pct: number } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    Order_Date: new Date().toISOString().split('T')[0],
    Product_Name: "",
    Sales: "",
    Category: "Other",
    type: "expense"
  });

  const fetchTransactions = async () => {
    const API_URL = import.meta.env.VITE_API_URL || '';

    // Load transactions immediately — don't block on analytics
    try {
      const txRes = await fetch(`${API_URL}/api/transactions`);
      const txData = await txRes.json();
      setTransactions(txData);
      const totalRevenue = txData.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + (t.Sales || 0), 0);
      const totalExpenses = txData.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + (t.Sales || 0), 0);
      setSummary({ totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses });
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }

    // Load analytics separately — if GLM is slow/down this won't block the page
    try {
      const analyticsRes = await fetch(`${API_URL}/api/analytics`);
      const analyticsData = await analyticsRes.json();
      if (analyticsData.categoryData && analyticsData.categoryData.length > 0) {
        setSummary(prev => {
          const top = analyticsData.categoryData[0];
          const pct = prev.totalExpenses > 0 ? Math.round((top.amount / prev.totalExpenses) * 100) : 0;
          setTopCostDriver({ category: top.category, amount: top.amount, pct });
          return prev;
        });
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/transactions/upload`, {
          method: 'POST',
          body: formData,
        });
        alert(`Successfully uploaded ${file.name}`);
        fetchTransactions();
      } catch (err) {
        console.error(err);
        alert('Upload failed');
      }
    }
  };

  const handleManualSubmit = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          Sales: parseFloat(formData.Sales) || 0
        }),
      });
      setIsAddModalOpen(false);
      setFormData({ Order_Date: new Date().toISOString().split('T')[0], Product_Name: "", Sales: "", Category: "Other", type: "expense" });
      fetchTransactions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCategoryChange = async (id: number, newCategory: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });
      fetchTransactions();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-6 pt-28 pb-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Expenses & Cashflow</h1>
          <p className="text-muted-foreground">Manage your transactions, upload CSVs, and analyze categorizations.</p>
        </div>

        {/* Top Cost Driver Alert */}
        {topCostDriver && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-8 flex items-start space-x-3 fade-in">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Top Cost Driver Identified</h3>
              <p className="text-sm text-destructive/90">Your biggest expense category is <span className="font-bold">{topCostDriver.category}</span> at ${topCostDriver.amount.toFixed(2)} ({topCostDriver.pct}% of total expenses). Consider reviewing this spend.</p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-card border border-border rounded-xl p-6 shadow-card hover:shadow-glow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground font-medium">Total Income</span>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <ArrowUpRight className="text-emerald-500 w-5 h-5" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-emerald-400">${summary.totalRevenue.toFixed(2)}</h2>
            <p className="text-sm text-emerald-500/80 mt-2">From all income transactions</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-card hover:shadow-glow-lg transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground font-medium">Total Expenses</span>
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <ArrowDownRight className="text-destructive w-5 h-5" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-destructive">${summary.totalExpenses.toFixed(2)}</h2>
            <p className="text-sm text-destructive/80 mt-2">From all expense transactions</p>
          </div>

          <div className="bg-gradient-primary rounded-xl p-6 shadow-glow position-relative overflow-hidden transform hover:-translate-y-1 transition-all">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/90 font-medium">Net Profit</span>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <DollarSign className="text-white w-5 h-5" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-white">${summary.netProfit.toFixed(2)}</h2>
              <p className="text-sm text-white/80 mt-2">{summary.netProfit >= 0 ? 'Healthy margin this period' : 'Net loss this period'}</p>
            </div>
          </div>
        </div>

        {/* Transactions Section */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
          <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold">Recent Transactions</h2>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <input 
                  type="file" 
                  accept=".csv" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                />
                <Button variant="outline" className="w-full">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload CSV
                </Button>
              </div>
              <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setIsAddModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Manual
              </Button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-sm">
                  <th className="p-4 font-medium">Order Date</th>
                  <th className="p-4 font-medium">Description</th>
                  <th className="p-4 font-medium">Amount</th>
                  <th className="p-4 font-medium">Category (Predicted)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => (
                  <tr key={tx.Row_ID} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-sm">{tx.Order_Date}</td>
                    <td className="p-4 font-medium">{tx.Product_Name}</td>
                    <td className={`p-4 font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-destructive'}`}>
                      {tx.type === 'income' ? '+' : '-'}${parseFloat(tx.Sales).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <select 
                        className="bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                        value={tx.Category}
                        onChange={(e) => handleCategoryChange(tx.Row_ID, e.target.value)}
                      >
                        <option value={tx.Category}>{tx.Category}</option>
                        <option value="Salary">Salary</option>
                        <option value="Rent">Rent</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Inventory">Inventory</option>
                        <option value="Transport">Transport</option>
                        <option value="Revenue">Revenue</option>
                        <option value="Miscellaneous">Miscellaneous</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* --- MOCK DATA FOR UI DEMO: MODAL POPUP FOR MANUAL ADD. FRIEND CAN ATTACH FORM SUBMIT TO BACKEND --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-glow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-lg">Add Transaction</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsAddModalOpen(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              {/* Income / Expense toggle */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: "income"})}
                    className={`py-2 rounded-md text-sm font-semibold border transition-colors ${formData.type === "income" ? "bg-emerald-500 border-emerald-500 text-white" : "bg-background border-border text-muted-foreground hover:border-emerald-500"}`}
                  >
                    + Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, type: "expense"})}
                    className={`py-2 rounded-md text-sm font-semibold border transition-colors ${formData.type === "expense" ? "bg-destructive border-destructive text-white" : "bg-background border-border text-muted-foreground hover:border-destructive"}`}
                  >
                    − Expense
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Order Date</label>
                <input 
                  type="date" 
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" 
                  value={formData.Order_Date}
                  onChange={e => setFormData({...formData, Order_Date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly office rent payment" 
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" 
                  value={formData.Product_Name}
                  onChange={e => setFormData({...formData, Product_Name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount ($)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none" 
                      value={formData.Sales}
                      onChange={e => setFormData({...formData, Sales: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  {formData.type === "income" ? (
                    <select
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                      value={formData.Category}
                      onChange={e => setFormData({...formData, Category: e.target.value})}
                    >
                      <option value="Revenue">Revenue</option>
                      <option value="Other">Auto-categorize (GLM)</option>
                    </select>
                  ) : (
                    <select
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                      value={formData.Category}
                      onChange={e => setFormData({...formData, Category: e.target.value})}
                    >
                      <option value="Other">Auto-categorize (GLM)</option>
                      <option value="Salary">Salary</option>
                      <option value="Rent">Rent</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Inventory">Inventory</option>
                      <option value="Transport">Transport</option>
                      <option value="Miscellaneous">Miscellaneous</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end p-4 border-t border-border space-x-2">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button className="bg-primary text-white" onClick={handleManualSubmit}>Save Transaction</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
