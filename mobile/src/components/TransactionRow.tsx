import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Transaction } from '@/api/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { colors, spacing, touchTarget, typography } from '@/theme/tokens';

interface TransactionRowProps {
  transaction: Transaction;
  onPress: (transaction: Transaction) => void;
}

export function TransactionRow({ transaction, onPress }: TransactionRowProps) {
  const isIncome = transaction.type === 'income';
  const sign = isIncome ? '+' : '−';
  const amount = formatCurrency(transaction.amount);
  const kind = isIncome ? 'Receita' : 'Despesa';
  const meta = [formatDate(transaction.date), transaction.category].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={() => onPress(transaction)}
      accessibilityRole="button"
      accessibilityLabel={`${kind}: ${transaction.description}, ${amount}, ${meta}`}
      accessibilityHint="Abre a transação para editar"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.dot, { backgroundColor: isIncome ? colors.income : colors.expense }]} />
      <View style={styles.body}>
        <Text style={styles.description} numberOfLines={2}>
          {transaction.description}
        </Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <Text style={[styles.amount, { color: isIncome ? colors.income : colors.expense }]}>
        {sign}
        {amount}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget + spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.background },
  dot: { width: 10, height: 10, borderRadius: 5 },
  body: { flex: 1, gap: 2 },
  description: { ...typography.body, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  amount: { ...typography.bodyStrong, fontVariant: ['tabular-nums'] },
});
