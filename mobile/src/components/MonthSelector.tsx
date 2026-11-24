import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MonthFilter } from '@/api/types';
import { capitalize, formatMonthYear, shiftMonth } from '@/lib/format';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/tokens';

interface MonthSelectorProps {
  value: MonthFilter;
  onChange: (value: MonthFilter) => void;
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const prev = shiftMonth(value.month, value.year, -1);
  const next = shiftMonth(value.month, value.year, 1);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(prev)}
        accessibilityRole="button"
        accessibilityLabel={`Mês anterior, ${formatMonthYear(prev.month, prev.year)}`}
        hitSlop={8}
        style={styles.arrow}
      >
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
      </Pressable>

      <Text style={styles.label} accessibilityRole="header" accessibilityLiveRegion="polite">
        {capitalize(formatMonthYear(value.month, value.year))}
      </Text>

      <Pressable
        onPress={() => onChange(next)}
        accessibilityRole="button"
        accessibilityLabel={`Mês seguinte, ${formatMonthYear(next.month, next.year)}`}
        hitSlop={8}
        style={styles.arrow}
      >
        <Ionicons name="chevron-forward" size={24} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
  },
  arrow: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.bodyStrong,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
});
