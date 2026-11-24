import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

interface ProgressBarProps {
  /** 0–1; values outside the range are clamped for display. */
  progress: number;
  label: string;
  color?: string;
}

export function ProgressBar({ progress, label, color = colors.primary }: ProgressBarProps) {
  const pct = Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct, text: `${pct}%` }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
