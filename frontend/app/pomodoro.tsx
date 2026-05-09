import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { Play, Pause, RotateCcw, X } from 'lucide-react-native';
import { useTheme } from '../src/contexts/ThemeContext';
import { Card } from '../src/components/Card';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { api } from '../src/lib/api';
import { spacing, radius } from '../src/theme/colors';

const PRESETS = [15, 25, 45, 60];

export default function PomodoroScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [duration, setDuration] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [subject, setSubject] = useState('');
  const intervalRef = useRef<any>(null);

  useEffect(() => { setSecondsLeft(duration * 60); }, [duration]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            handleComplete();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const handleComplete = async () => {
    try {
      await api('/pomodoro', { method: 'POST', json: { duration_minutes: duration, subject } });
      Alert.alert('Great work!', `${duration}-minute focus session logged.`);
    } catch {}
  };

  const reset = () => { setRunning(false); setSecondsLeft(duration * 60); };

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const size = 240;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = duration * 60;
  const progress = total > 0 ? (total - secondsLeft) / total : 0;
  const dashOffset = c * (1 - progress);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']} testID="pomodoro-screen">
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textMain }]}>Focus Timer</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} testID="close-pomodoro">
          <X size={22} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.center}>
        <View>
          <Svg width={size} height={size}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.border} strokeWidth={stroke} fill="none" />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={theme.primary}
              strokeWidth={stroke}
              strokeDasharray={c}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              fill="none"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[styles.timeText, { color: theme.textMain }]}>{mins}:{secs}</Text>
            <Text style={[styles.timeSub, { color: theme.textMuted }]}>{running ? 'In focus' : 'Ready'}</Text>
          </View>
        </View>

        <View style={{ height: spacing.xl }} />

        <View style={styles.presets}>
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => { setDuration(p); }}
              activeOpacity={0.85}
              style={[
                styles.preset,
                {
                  backgroundColor: duration === p ? theme.primary : 'transparent',
                  borderColor: duration === p ? theme.primary : theme.border,
                },
              ]}
              testID={`preset-${p}`}
            >
              <Text style={{ color: duration === p ? '#FFF' : theme.textMain, fontSize: 13, fontFamily: 'Manrope_600SemiBold' }}>{p}m</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: spacing.lg, width: '100%' }} />
        <View style={{ width: '100%', paddingHorizontal: spacing.xl }}>
          <Input placeholder="Subject (optional)" value={subject} onChangeText={setSubject} testID="pomo-subject" />
        </View>

        <View style={{ height: spacing.xl }} />

        <View style={styles.controls}>
          <TouchableOpacity onPress={reset} style={[styles.ctrlBtn, { borderColor: theme.border }]} testID="reset-pomo">
            <RotateCcw size={20} color={theme.textMain} />
          </TouchableOpacity>
          <View style={{ width: 16 }} />
          <TouchableOpacity onPress={() => setRunning(r => !r)} style={[styles.bigBtn, { backgroundColor: theme.primary }]} testID="play-pause">
            {running ? <Pause size={28} color="#FFF" /> : <Play size={28} color="#FFF" />}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontFamily: 'Outfit_700Bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  timeText: { fontSize: 56, fontFamily: 'Outfit_700Bold', letterSpacing: -1.5 },
  timeSub: { fontSize: 13, fontFamily: 'Manrope_500Medium', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  presets: { flexDirection: 'row', gap: 8, marginTop: 24 },
  preset: { paddingHorizontal: 16, height: 36, borderRadius: 9999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ctrlBtn: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bigBtn: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
});
