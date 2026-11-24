import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, type ColorValue } from 'react-native';

import { colors, spacing, touchTarget } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Resumo', tabBarIcon: icon('pie-chart-outline'), tabBarAccessibilityLabel: 'Resumo' }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transações',
          tabBarIcon: icon('swap-vertical-outline'),
          tabBarAccessibilityLabel: 'Transações',
          headerRight: () => <AddTransactionButton />,
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Subscrições',
          tabBarIcon: icon('repeat-outline'),
          tabBarAccessibilityLabel: 'Subscrições',
        }}
      />
    </Tabs>
  );
}

function AddTransactionButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/transaction')}
      accessibilityRole="button"
      accessibilityLabel="Adicionar transação"
      hitSlop={8}
      style={{
        minWidth: touchTarget,
        minHeight: touchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
      }}
    >
      <Ionicons name="add-circle" size={30} color={colors.primary} />
    </Pressable>
  );
}
