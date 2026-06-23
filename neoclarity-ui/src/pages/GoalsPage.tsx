import { useState } from 'react';
import { goalApi } from '../api/services';
import { useApi } from '../hooks/useApi';
import { Card, SectionTitle, Btn, ProgressBar, Spinner, Empty, fmt, C, scoreColor } from '../components/ui';
import type { GoalType } from '../types';

const GOAL_ICONS: Record<GoalType, string> = {
  EMERGENCY_FUND: '🛡️',
  VACATION:       '✈️',
  COLLEGE:        '🎓',
  DEBT_PAYOFF:    '📉',
};

const GOAL_LABELS: Record<GoalType, string> = {
  EMERGENCY_FUND: 'Emergency Fund',
  VACATION:       'Vacation Fund',
  COLLEGE:        'College Fund',
  DEBT_PAYOFF:    'Debt Payoff',
};

export function GoalsPage() {
  const { data: goals, loading, refetch } = useApi(goalApi.list);
  const [adding, setAdding] = useState(false);
  const [newGoal, setNewGoal] = useState({ goalType: 'EMERGENCY_FUND' as GoalType, targetAmount: '', monthlyContribution: '' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await goalApi.create({
        goalType: newGoal.goalType,
        targetAmount: parseFloat(newGoal.targetAmount),
        monthlyContribution: parseFloat(newGoal.monthlyContribution) || 0,
      });
      setAdding(false);
      setNewGoal({ goalType: 'EMERGENCY_FUND', targetAmount: '', monthlyContribution: '' });
      refetch();
    } finally {
      setSaving(false);
    }
  };

  const handlePause = async (goalId: string, status: string) => {
    if (status === 'ACTIVE') await goalApi.pause(goalId);
    else await goalApi.resume(goalId);
    refetch();
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.gray800, margin: 0 }}>My Goals</h2>
        <Btn label="+ Add Goal" variant="secondary" small onClick={() => setAdding(true)} />
      </div>

      {adding && (
        <Card style={{ border: `2px solid ${C.accent}` }}>
          <SectionTitle>New Goal</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={newGoal.goalType}
                onChange={e => setNewGoal(g => ({ ...g, goalType: e.target.value as GoalType }))}
                style={inputStyle}>
                {(Object.keys(GOAL_LABELS) as GoalType[]).map(t => (
                  <option key={t} value={t}>{GOAL_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Target Amount ($)</label>
              <input type="number" value={newGoal.targetAmount}
                onChange={e => setNewGoal(g => ({ ...g, targetAmount: e.target.value }))}
                style={inputStyle} placeholder="e.g. 15000" />
            </div>
            <div>
              <label style={labelStyle}>Monthly Contribution ($)</label>
              <input type="number" value={newGoal.monthlyContribution}
                onChange={e => setNewGoal(g => ({ ...g, monthlyContribution: e.target.value }))}
                style={inputStyle} placeholder="e.g. 300" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn label={saving ? 'Saving…' : 'Create Goal'} variant="success" onClick={handleCreate} disabled={saving} />
            <Btn label="Cancel" variant="ghost" onClick={() => setAdding(false)} />
          </div>
        </Card>
      )}

      {(!goals || goals.length === 0) && !adding && (
        <Empty icon="🎯" message="No goals yet. Add your first goal to get started." />
      )}

      {goals?.map(goal => {
        const gtype = goal.goalType as GoalType;
        const color = scoreColor(goal.progressPercent);
        return (
          <Card key={goal.goalId}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 32 }}>{GOAL_ICONS[gtype] ?? '🎯'}</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.gray800 }}>{GOAL_LABELS[gtype] ?? goal.goalType}</div>
                  <div style={{ fontSize: 12, color: C.gray400 }}>
                    {fmt.currency(goal.monthlyContribution)}/month contributing
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color }}>{goal.progressPercent}%</div>
                <div style={{ fontSize: 11, color: C.gray400 }}>complete</div>
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <ProgressBar value={goal.currentAmount} max={goal.targetAmount} color={color} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: C.gray600 }}>{fmt.currency(goal.currentAmount)} saved</span>
              <span style={{ fontSize: 12, color: C.gray600 }}>Target: {fmt.currency(goal.targetAmount)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {goal.deadline && (
                <div style={{ background: C.lightBg, borderRadius: 8, padding: '6px 12px', fontSize: 12, color: C.accent }}>
                  📅 Deadline: <strong>{fmt.date(goal.deadline)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <Btn label={goal.status === 'ACTIVE' ? 'Pause' : 'Resume'} variant="ghost" small
                  onClick={() => handlePause(goal.goalId, goal.status)} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 7,
  border: '1.5px solid #E5E7EB', fontSize: 13,
  boxSizing: 'border-box',
};
