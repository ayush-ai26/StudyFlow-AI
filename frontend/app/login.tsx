import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ImageBackground, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';
import { Button } from '../src/components/Button';
import { Sparkles } from 'lucide-react-native';

const BG = 'https://images.pexels.com/photos/8004117/pexels-photo-8004117.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1536&w=1024';

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, signInWithGoogle, signInAsGuest, loading } = useAuth();

  useEffect(() => {
    if (user) router.replace('/(tabs)');
  }, [user]);

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (e: any) {
      Alert.alert('Sign-in failed', e.message || 'Please try again');
    }
  };

  const handleGuest = async () => {
    try {
      await signInAsGuest();
    } catch (e: any) {
      Alert.alert('Could not start guest session', e.message || 'Try again');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ImageBackground source={{ uri: BG }} style={styles.bg} resizeMode="cover">
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', theme.background]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View style={styles.bottom}>
        <View style={[styles.badge, { borderColor: theme.border }]}>
          <Sparkles size={14} color={theme.primary} />
          <Text style={[styles.badgeText, { color: theme.textMuted }]}>AI-powered study companion</Text>
        </View>
        <Text style={[styles.title, { color: theme.textMain }]}>Master your studies{'\n'}with StudyFlow AI</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          Plan, focus, and ace SAT & IELTS — all in one beautifully simple app.
        </Text>

        <View style={{ height: 28 }} />

        <Button
          title="Continue with Google"
          onPress={handleGoogle}
          loading={loading}
          testID="google-signin-button"
        />
        <View style={{ height: 12 }} />
        <Button
          title="Continue as Guest"
          variant="secondary"
          onPress={handleGuest}
          loading={loading}
          testID="guest-signin-button"
        />

        <Text style={[styles.terms, { color: theme.textMuted }]}>
          By continuing you agree to our Terms & Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bg: { flex: 1 },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    paddingTop: 24,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    marginBottom: 14,
    gap: 6,
  },
  badgeText: { fontSize: 12, fontFamily: 'Manrope_500Medium' },
  title: { fontSize: 32, fontFamily: 'Outfit_700Bold', letterSpacing: -0.7, lineHeight: 38 },
  sub: { marginTop: 10, fontSize: 15, fontFamily: 'Manrope_400Regular', lineHeight: 22 },
  terms: { textAlign: 'center', fontSize: 11, marginTop: 16, fontFamily: 'Manrope_400Regular' },
});
