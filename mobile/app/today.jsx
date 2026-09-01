import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/supabase';
import { useAuth } from '../src/AuthContext';
import { colors, type, spacing, radius } from '../src/theme';

/**
 * Placeholder Today screen. It exists so the auth round trip can be proven end
 * to end on a device before any of the real screens are ported — sign in,
 * background the app, come back, and confirm the session survived.
 */
export default function Today() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}>
      <Text style={styles.brand}>Today</Text>
      <Text style={styles.title}>Signed in</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Account</Text>
        <Text style={styles.cardValue}>{user?.email ?? '—'}</Text>
      </View>
      <Pressable onPress={() => supabase.auth.signOut()} style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}>
        <Text style={styles.secondaryText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  brand: { ...type.label, color: colors.primary, textTransform: 'uppercase' },
  title: { ...type.h1, color: colors.foreground, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.card, padding: spacing.lg, gap: spacing.xs,
  },
  cardLabel: { ...type.small, color: colors.muted },
  cardValue: { ...type.body, color: colors.foreground, fontWeight: '600' },
  secondary: {
    marginTop: spacing.lg, height: 48, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  secondaryText: { ...type.body, color: colors.foreground, fontWeight: '600' },
});
