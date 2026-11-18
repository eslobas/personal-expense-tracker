import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { TransactionInput } from '@/api/types';
import { Button } from '@/components/Button';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { TransactionForm } from '@/components/TransactionForm';
import { useApiQuery } from '@/hooks/useApiQuery';
import { colors, spacing, typography } from '@/theme/tokens';

/** Add (no `id` param) or edit (`?id=123`) a transaction. */
export default function TransactionScreen() {
  const router = useRouter();
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();
  const id = idParam ? Number(idParam) : null;
  const isEdit = id !== null && Number.isFinite(id);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const existing = useApiQuery(
    useCallback(() => (isEdit ? api.getTransaction(id) : Promise.resolve(null)), [isEdit, id]),
  );

  const handleSubmit = async (input: TransactionInput) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isEdit) await api.updateTransaction(id, input);
      else await api.createTransaction(input);
      router.back();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao guardar.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = () => {
    if (!isEdit) return;
    Alert.alert('Apagar transação?', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.deleteTransaction(id);
            router.back();
          } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Erro ao apagar.');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const title = isEdit ? 'Editar transação' : 'Nova transação';

  if (isEdit && existing.loading) return <LoadingState />;
  if (isEdit && existing.error) return <ErrorState error={existing.error} onRetry={existing.reload} />;

  const t = existing.data;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {submitError ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              {submitError}
            </Text>
          </View>
        ) : null}

        <TransactionForm
          key={t?.id ?? 'new'}
          mode={isEdit ? 'edit' : 'create'}
          submitting={submitting}
          onSubmit={handleSubmit}
          initialValues={
            t
              ? {
                  type: t.type,
                  description: t.description,
                  amount: String(t.amount).replace('.', ','),
                  date: t.date,
                  category: t.category ?? '',
                }
              : undefined
          }
        />

        {isEdit ? (
          <Button label="Apagar transação" variant="danger" onPress={confirmDelete} loading={deleting} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  banner: {
    backgroundColor: colors.expenseSoft,
    borderColor: colors.expense,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
  },
  bannerText: { ...typography.body, color: colors.expense },
});
