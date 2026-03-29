'use client';

import { useState } from 'react';
import { Expense } from '@/lib/types';
import { currency } from '@/lib/utils';
import { saveExpense, deleteExpenseById, DB } from '@/lib/database';

const CAT_LABELS: Record<string, string> = {
  contractor: 'Contractor',
  software: 'Software',
  materials: 'Materials',
  travel: 'Travel',
  other: 'Other',
};

const CAT_COLORS: Record<string, string> = {
  contractor: 'bg-blue-100 text-blue-800 border-blue-300',
  software: 'bg-purple-100 text-purple-800 border-purple-300',
  materials: 'bg-green-100 text-green-800 border-green-300',
  travel: 'bg-orange-100 text-orange-800 border-orange-300',
  other: 'bg-slate-100 text-slate-800 border-slate-300',
};

interface ExpensesListProps {
  expenses: Expense[];
}

export default function ExpensesList({ expenses }: ExpensesListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Expense>>({});
  const [loading, setLoading] = useState(false);

  const handleStartEdit = (exp: Expense) => {
    setEditingId(exp.id || null);
    setFormData({ ...exp });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({});
  };

  const handleSaveEdit = async (expId: string | undefined) => {
    if (!expId) return;
    setLoading(true);

    const exp = DB.expenses.find((e) => e.id === expId);
    if (exp) {
      Object.assign(exp, formData);
      await saveExpense(exp);
    }

    setEditingId(null);
    setFormData({});
    setLoading(false);
  };

  const handleDeleteExpense = async (expId: string | undefined) => {
    if (!expId || !confirm('Delete this expense?')) return;

    setLoading(true);
    await deleteExpenseById(expId);
    DB.expenses = DB.expenses.filter((e) => e.id !== expId);
    setLoading(false);
  };

  const handleAddExpense = async () => {
    if (!formData.date || !formData.amount || formData.amount <= 0) {
      alert('Please fill in date and amount');
      return;
    }

    setLoading(true);
    const newExp: Expense = {
      date: formData.date,
      category: formData.category || 'other',
      vendor: formData.vendor || '',
      description: formData.description || '',
      amount: formData.amount,
      notes: formData.notes || '',
    };

    const saved = await saveExpense(newExp);
    if (saved) {
      DB.expenses.unshift({ ...newExp, id: saved.id });
    }

    setShowAddForm(false);
    setFormData({});
    setLoading(false);
  };

  if (expenses.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p className="text-sm">No expenses logged for this period.</p>
        <button
          onClick={() => setShowAddForm(true)}
          className="text-indigo-600 font-semibold text-xs mt-2 hover:text-indigo-700"
        >
          + Log your first expense
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {expenses.map((exp) => (
        <div key={exp.id} className="border border-slate-200 rounded-lg overflow-hidden">
          <div
            className="p-4 hover:bg-slate-50 cursor-pointer"
            onClick={() => handleStartEdit(exp)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-2 py-1 text-xs font-semibold rounded border ${
                      CAT_COLORS[exp.category] || CAT_COLORS['other']
                    }`}
                  >
                    {CAT_LABELS[exp.category] || 'Other'}
                  </span>
                  <div className="font-semibold text-slate-900">
                    {exp.vendor || exp.description || 'Expense'}
                  </div>
                </div>
                {exp.description && exp.vendor && (
                  <div className="text-xs text-slate-500 mt-1">{exp.description}</div>
                )}
              </div>
              <div className="text-right ml-4 flex-shrink-0">
                <div className="text-xs text-slate-500 mb-1">{exp.date}</div>
                <div className="text-sm font-bold text-red-600">−{currency(exp.amount)}</div>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          {editingId === exp.id && (
            <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="form-input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount || ''}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="form-input w-full text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Vendor</label>
                <input
                  type="text"
                  value={formData.vendor || ''}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  placeholder="Vendor / payee"
                  className="form-input w-full text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Category</label>
                  <select
                    value={formData.category || 'other'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-input w-full text-sm"
                  >
                    {Object.entries(CAT_LABELS).map(([cat, label]) => (
                      <option key={cat} value={cat}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description"
                    className="form-input w-full text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleSaveEdit(exp.id)}
                  disabled={loading}
                  className="btn btn-primary btn-sm text-xs"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="btn btn-ghost btn-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteExpense(exp.id)}
                  disabled={loading}
                  className="btn btn-danger btn-sm text-xs ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add New Expense Form */}
      {showAddForm && (
        <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 space-y-3 mt-4">
          <div className="font-semibold text-slate-900 text-sm">Log New Expense</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Date</label>
              <input
                type="date"
                value={formData.date || new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="form-input w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="form-input w-full text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Vendor</label>
            <input
              type="text"
              placeholder="Vendor / payee"
              value={formData.vendor || ''}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              className="form-input w-full text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Category</label>
              <select
                value={formData.category || 'other'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="form-input w-full text-sm"
              >
                {Object.entries(CAT_LABELS).map(([cat, label]) => (
                  <option key={cat} value={cat}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Description</label>
              <input
                type="text"
                placeholder="Description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-input w-full text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleAddExpense}
              disabled={loading}
              className="btn btn-primary btn-sm text-xs"
            >
              {loading ? 'Saving...' : 'Log Expense'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setFormData({});
              }}
              className="btn btn-ghost btn-sm text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="text-indigo-600 font-semibold text-xs hover:text-indigo-700 mt-2"
        >
          + Add Expense
        </button>
      )}
    </div>
  );
}
