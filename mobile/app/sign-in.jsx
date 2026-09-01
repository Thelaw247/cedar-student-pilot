import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/supabase';
import { colors, type, spacing, radius } from '../src/theme';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    // No manual navigation on success: AuthProvider picks up the session and
    // index.jsx redirects. Routing here as well would race that and can land
    // the user on /today before the session is readable.
    if (err) setError(err.message);
    else router.replace('/today');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.brand}>Praelecta</Text>
        <Text style={styles.title}>Sign in</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
        />

        <Pressable
          onPress={submit}
          disabled={busy || !email || !password}
          style={({ pressed }) => [styles.cta, (busy || !email || !password) && styles.ctaDisabled, pressed && styles.ctaPressed]}
        >
          {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.ctaText}>Sign in</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  brand: { ...type.label, color: colors.primary, textTransform: 'uppercase', marginBottom: spacing.xs },
  title: { ...type.h1, color: colors.foreground, marginBottom: spacing.lg },
  label: { ...type.small, color: colors.muted, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 48,
    color: colors.foreground, ...type.body,
  },
  cta: {
    marginTop: spacing.xl, height: 50, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaPressed: { backgroundColor: colors.primaryPressed },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { ...type.body, fontWeight: '600', color: colors.primaryForeground },
  error: { ...type.small, color: colors.destructive, marginBottom: spacing.sm },
});
