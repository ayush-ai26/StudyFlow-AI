import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';

export default function SplashIndex() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, initialized } = useAuth();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const t = setTimeout(() => {
      if (user) router.replace('/(tabs)');
      else router.replace('/login');
    }, 1100);
    return () => clearTimeout(t);
  }, [initialized, user]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} testID="splash-screen">
      <Animated.View style={{ alignItems: 'center', opacity: fade, transform: [{ scale }] }}>
        <View style={[styles.logo, { backgroundColor: theme.primary }]}>
          <Sparkles size={36} color="#FFF" />
        </View>
        <Text style={[styles.title, { color: theme.textMain }]}>StudyFlow AI</Text>
        <Text style={[styles.tag, { color: theme.textMuted }]}>Plan smarter. Study deeper.</Text>
      </Animated.View>
      <View style={{ position: 'absolute', bottom: 60 }}>
        <ActivityIndicator color={theme.textMuted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 88, height: 88, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  title: { fontSize: 32, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  tag: { marginTop: 8, fontSize: 14, fontFamily: 'Manrope_500Medium' },
});
