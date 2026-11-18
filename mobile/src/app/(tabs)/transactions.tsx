import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { MonthFilter, Transaction } from '@/api/types';
import { MonthSelector } from '@/components/MonthSelector';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { TransactionRow } from '@/components/TransactionRow';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatCurrency, formatMonthYear } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme/tokens';

function currentMonth(): MonthFilter {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export default function TransactionsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<MonthFilter>(currentMonth);

  const fetcher = useCallback(() => api.getTransactions(filter), [filter]);
  const { data, error, loading, refreshing, reload, refresh } = useApiQuery(fetcher);

  const summary = useMemo(() => {
    const list = data ?? [];
    const income = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expenses };
  }, [data]);

  const openTransaction = useCallback(
    (t: Transaction) => router.push({ pathname: '/transaction', params: { id: String(t.id) } }),
    [router],
  );

  const header = (
    <View style={styles.header}>
      <MonthSelector value={filter} onChange={setFilter} />
      {data && data.length > 0 ? (
        <View style={styles.summary}>
          <Text style={[styles.summaryText, { color: colors.income }]}>
            Receitas {formatCurrency(summary.income)}
          </Text>
          <Text style={[styles.summaryText, { color: colors.expense }]}>
            Despesas {formatCurrency(summary.expenses)}
          </Text>
        </View>
      ) : null}
    </View>
  );

  let body;
  if (loading) body = <LoadingState />;
  else if (error && !data) body = <ErrorState error={error} onRetry={reload} />;
  else
    body = (
      <FlatList
        data={data ?? []}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => <TransactionRow transaction={item} onPress={openTransaction} />}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            title="Sem transações"
            message={`Não há movimentos em ${formatMonthYear(filter.month, filter.year)}.`}
          />
        }
      />
    );

  return (
    <View style={styles.screen}>
      {header}
      {body}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { padding: spacing.lg, gap: spacing.md },
  summary: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  summaryText: { ...typography.bodyStrong, fontVariant: ['tabular-nums'] },
  listContent: {
    flexGrow: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
