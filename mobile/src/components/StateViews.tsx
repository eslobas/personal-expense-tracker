import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { API_URL } from '@/api/client';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from './Button';

export function LoadingState({ label = 'A carregar…' }: { label?: string }) {
  return (
    <View style={styles.center} accessible accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title} accessibilityRole="header">
        Algo correu mal
      </Text>
      <Text style={styles.muted} accessibilityRole="alert" accessibilityLiveRegion="polite">
        {error.message}
      </Text>
      <Text style={styles.hint}>API: {API_URL}</Text>
      <Button label="Tentar novamente" onPress={onRetry} variant="secondary" />
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  muted: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
