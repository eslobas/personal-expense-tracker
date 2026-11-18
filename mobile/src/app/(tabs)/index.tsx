import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatCurrency, formatMonthYear } from '@/lib/format';
import { colors, spacing, typography } from '@/theme/tokens';

async function loadDashboard() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const [balance, totals, savingsGoal] = await Promise.all([
    api.getBalance(),
    api.getMonthlyTotals({ month, year }),
    api.getSavingsGoal(),
  ]);
  return { balance, totals, savingsGoal, month, year };
}

export default function DashboardScreen() {
  const { data, error, loading, refreshing, reload, refresh } = useApiQuery(
    useCallback(loadDashboard, []),
  );

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const { balance, totals, savingsGoal, month, year } = data;
  const saved = totals.income - totals.expenses;
  const maxBar = Math.max(totals.income, totals.expenses, 1);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <Card title="Saldo atual">
        <Text
          style={[styles.balance, { color: balance < 0 ? colors.expense : colors.text }]}
          accessibilityLabel={`Saldo atual: ${formatCurrency(balance)}`}
        >
          {formatCurrency(balance)}
        </Text>
      </Card>

      <Card title={`Este mês · ${formatMonthYear(month, year)}`}>
        <Row label="Receitas" value={totals.income} color={colors.income} max={maxBar} />
        <Row label="Despesas" value={totals.expenses} color={colors.expense} max={maxBar} />
        <View style={styles.divider} />
        <View style={styles.rowBetween} accessible accessibilityLabel={`Saldo do mês: ${formatCurrency(saved)}`}>
          <Text style={styles.label}>Saldo do mês</Text>
          <Text style={[styles.value, { color: saved < 0 ? colors.expense : colors.income }]}>
            {formatCurrency(saved)}
          </Text>
        </View>
      </Card>

      <Card title="Meta de poupança mensal">
        {savingsGoal ? (
          <SavingsGoal saved={saved} goal={savingsGoal} />
        ) : (
          <Text style={styles.muted}>Ainda não definiste uma meta. Podes defini-la na versão web.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

function Row({ label, value, color, max }: { label: string; value: number; color: string; max: number }) {
  return (
    <View style={styles.rowGroup}>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color }]}>{formatCurrency(value)}</Text>
      </View>
      <ProgressBar progress={value / max} color={color} label={`${label}: ${formatCurrency(value)}`} />
    </View>
  );
}

function SavingsGoal({ saved, goal }: { saved: number; goal: number }) {
  const progress = Math.max(saved, 0) / goal;
  const pct = Math.round(Math.min(progress, 1) * 100);
  const reached = saved >= goal;
  return (
    <View style={styles.rowGroup}>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>
          {formatCurrency(Math.max(saved, 0))} de {formatCurrency(goal)}
        </Text>
        <Text style={styles.value}>{pct}%</Text>
      </View>
      <ProgressBar
        progress={progress}
        color={reached ? colors.income : colors.primary}
        label="Progresso da meta de poupança"
      />
      <Text style={styles.muted}>
        {reached
          ? 'Meta atingida este mês. 🎉'
          : `Faltam ${formatCurrency(goal - Math.max(saved, 0))} para atingir a meta.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  balance: { ...typography.display, fontVariant: ['tabular-nums'] },
  rowGroup: { gap: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  label: { ...typography.body, color: colors.text },
  value: { ...typography.bodyStrong, color: colors.text, fontVariant: ['tabular-nums'] },
  muted: { ...typography.body, color: colors.textMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
