import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Subscription, SubscriptionFrequency } from '@/api/types';
import { Card } from '@/components/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatCurrency, formatDate, monthlyCost } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const FREQUENCY_LABEL: Record<SubscriptionFrequency, string> = {
  mensal: 'Mensal',
  anual: 'Anual',
  semanal: 'Semanal',
  outro: 'Outro',
};

export default function SubscriptionsScreen() {
  const { data, error, loading, refreshing, reload, refresh } = useApiQuery(
    useCallback(() => api.getSubscriptions(), []),
  );

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;

  const subs = data ?? [];
  const total = subs.reduce((sum, s) => sum + monthlyCost(s.amount, s.frequency), 0);

  return (
    <FlatList
      data={subs}
      keyExtractor={(s) => String(s.id)}
      renderItem={({ item }) => <SubscriptionRow subscription={item} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        subs.length > 0 ? (
          <View style={styles.header}>
            <Card title="Custo mensal estimado">
              <Text style={styles.total} accessibilityLabel={`Custo mensal estimado: ${formatCurrency(total)}`}>
                {formatCurrency(total)}
              </Text>
              <Text style={styles.muted}>
                {subs.length} {subs.length === 1 ? 'subscrição ativa' : 'subscrições ativas'}
              </Text>
            </Card>
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyState title="Sem subscrições" message="Ainda não tens subscrições ativas." />
      }
    />
  );
}

function SubscriptionRow({ subscription: s }: { subscription: Subscription }) {
  const freq = FREQUENCY_LABEL[s.frequency] ?? s.frequency;
  const next = formatDate(s.nextPayment);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${s.name}, ${formatCurrency(s.amount)}, ${freq}, próximo pagamento a ${next}`}
    >
      <View style={styles.rowBody}>
        <Text style={styles.name}>{s.name}</Text>
        <Text style={styles.muted}>
          {freq} · próximo: {next}
        </Text>
      </View>
      <Text style={styles.amount}>{formatCurrency(s.amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  total: { ...typography.display, color: colors.text, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  rowBody: { flex: 1, gap: 2 },
  name: { ...typography.bodyStrong, color: colors.text },
  amount: { ...typography.bodyStrong, color: colors.expense, fontVariant: ['tabular-nums'] },
  muted: { ...typography.caption, color: colors.textMuted },
  separator: { height: spacing.sm },
});
