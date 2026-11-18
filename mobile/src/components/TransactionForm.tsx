import { useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import type { TransactionInput, TransactionType } from '@/api/types';
import { isValidISODate, parseAmount, todayISO } from '@/lib/format';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/tokens';
import { Button } from './Button';

export interface TransactionFormValues {
  type: TransactionType;
  description: string;
  amount: string;
  date: string;
  category: string;
}

type FieldErrors = Partial<Record<'description' | 'amount' | 'date', string>>;

export function validateTransaction(values: TransactionFormValues): {
  errors: FieldErrors;
  input: TransactionInput | null;
} {
  const errors: FieldErrors = {};
  const description = values.description.trim();
  const amount = parseAmount(values.amount);
  const date = values.date.trim();

  if (!description) errors.description = 'Indica uma descrição.';
  else if (description.length > 255) errors.description = 'Máximo de 255 caracteres.';

  if (!values.amount.trim()) errors.amount = 'Indica um valor.';
  else if (amount === null) errors.amount = 'Valor inválido. Usa um número positivo, ex.: 12,50.';

  if (!isValidISODate(date)) errors.date = 'Data inválida. Usa o formato AAAA-MM-DD.';

  if (Object.keys(errors).length > 0 || amount === null) return { errors, input: null };

  return {
    errors,
    input: {
      type: values.type,
      description,
      amount,
      date,
      category: values.category.trim() || null,
    },
  };
}

interface TransactionFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<TransactionFormValues>;
  onSubmit: (input: TransactionInput) => Promise<void> | void;
  submitting?: boolean;
}

export function TransactionForm({ mode, initialValues, onSubmit, submitting = false }: TransactionFormProps) {
  const [values, setValues] = useState<TransactionFormValues>({
    type: 'expense',
    description: '',
    amount: '',
    date: todayISO(),
    category: '',
    ...initialValues,
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = <K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async () => {
    const result = validateTransaction(values);
    setErrors(result.errors);
    if (!result.input) {
      AccessibilityInfo.announceForAccessibility('O formulário tem erros. Revê os campos assinalados.');
      return;
    }
    await onSubmit(result.input);
  };

  const typeLocked = mode === 'edit';

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Text style={styles.label} nativeID="type-label">
          Tipo
        </Text>
        <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabelledBy="type-label">
          <TypeOption
            label="Despesa"
            selected={values.type === 'expense'}
            disabled={typeLocked}
            onPress={() => set('type', 'expense')}
          />
          <TypeOption
            label="Receita"
            selected={values.type === 'income'}
            disabled={typeLocked}
            onPress={() => set('type', 'income')}
          />
        </View>
        {typeLocked ? <Text style={styles.help}>O tipo não pode ser alterado depois de criado.</Text> : null}
      </View>

      <Field
        label="Descrição"
        value={values.description}
        onChangeText={(t) => set('description', t)}
        error={errors.description}
        placeholder="Ex.: Supermercado"
        maxLength={255}
        autoCapitalize="sentences"
        returnKeyType="next"
      />
      <Field
        label="Valor (€)"
        value={values.amount}
        onChangeText={(t) => set('amount', t)}
        error={errors.amount}
        placeholder="0,00"
        keyboardType="decimal-pad"
      />
      <Field
        label="Data"
        value={values.date}
        onChangeText={(t) => set('date', t)}
        error={errors.date}
        placeholder="AAAA-MM-DD"
        help="Formato AAAA-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />
      <Field
        label="Categoria (opcional)"
        value={values.category}
        onChangeText={(t) => set('category', t)}
        placeholder="Ex.: Alimentação"
        maxLength={100}
        autoCapitalize="sentences"
      />

      <Button
        label={mode === 'create' ? 'Adicionar transação' : 'Guardar alterações'}
        onPress={handleSubmit}
        loading={submitting}
      />
    </View>
  );
}

function TypeOption({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.option, selected && styles.optionSelected, disabled && !selected && styles.optionDisabled]}
    >
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  help?: string;
}

function Field({ label, error, help, ...inputProps }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityHint={error ?? help}
        aria-invalid={Boolean(error)}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null]}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : help ? (
        <Text style={styles.help} importantForAccessibility="no">
          {help}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  field: { gap: spacing.xs },
  label: { ...typography.bodyStrong, color: colors.text },
  help: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.expense, fontWeight: '600' },
  input: {
    ...typography.body,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  inputError: { borderColor: colors.expense, borderWidth: 2 },
  segmented: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionDisabled: { opacity: 0.55 },
  optionLabel: { ...typography.bodyStrong, color: colors.text },
  optionLabelSelected: { color: colors.textOnPrimary },
});
