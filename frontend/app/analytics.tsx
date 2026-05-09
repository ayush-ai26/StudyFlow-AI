import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Flame, Timer, CheckCircle2, Plus, Minus } from 'lucide-react-native';
import { useTheme } from '../src/contexts/ThemeContext';
import { Card } from '../src/components/Card';
import { api } from '../src/lib/api';
import { spacing, radius } from '../src/theme/colors';

interface Summary {
  total_tasks: number; completed_tasks: number; completion_rate: number;
  weekly_hours: number; weekly_minutes: number; streak_days: number; total_sessions: number;
  daily_minutes: { date: string; minutes: number }[];
}
interface Prep {
  sat_progress: number; ielts_progress: number;
  sat_target_date?: string | null; ielts_target_date?: string | null;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [prep, setPrep] = useState<Prep | null>(null);

  const load = async () => {
    try {
      const [s, p] = await Promise.all([api<Summary>('/analytics/summary'), api<Prep>('/prep')]);
      setSummary(s); setPrep(p);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const adjust = async (kind: 'sat' | 'ielts', delta: number) => {
    if (!prep) return;
    const key = kind === 'sat' ? 'sat_progress' : 'ielts_progress';
    const next = Math.max(0, Math.min(100, (prep as any)[key] + delta));
    setPrep({ ...prep, [key]: next });
    try { await api('/prep', { method: 'PATCH', json: { [key]: next } }); } catch {}
  };

  const maxMinutes = summary ? Math.max(...summary.daily_minutes.map(d => d.minutes), 1) : 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']} testID="analytics-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-analytics" hitSlop={8}>
          <ArrowLeft size={22} color={theme.textMain} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textMain }]}>Analytics</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }}>
        <View style={styles.row}>
          <Card style={{ flex: 1, marginRight: 6 }}>
            <View style={styles.statHead}><Timer size={14} color={theme.primary} /></View>
            <Text style={[styles.statValue, { color: theme.textMain }]}>{summary?.weekly_hours ?? 0}h</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>This week</Text>
          </Card>
          <Card style={{ flex: 1, marginHorizontal: 6 }}>
            <View style={styles.statHead}><Flame size={14} color={theme.primary} /></View>
            <Text style={[styles.statValue, { color: theme.textMain }]}>{summary?.streak_days ?? 0}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Day streak</Text>
          </Card>
          <Card style={{ flex: 1, marginLeft: 6 }}>
            <View style={styles.statHead}><CheckCircle2 size={14} color={theme.primary} /></View>
            <Text style={[styles.statValue, { color: theme.textMain }]}>{summary?.completion_rate ?? 0}%</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Completion</Text>
          </Card>
        </View>

        <View style={{ height: spacing.xl }} />

        <Text style={[styles.section, { color: theme.textMain }]}>Weekly study minutes</Text>
        <View style={{ height: 12 }} />
        <Card>
          <View style={styles.chart}>
            {summary?.daily_minutes.map(d => {
              const h = (d.minutes / maxMinutes) * 120;
              const day = new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
              return (
                <View key={d.date} style={styles.barWrap}>
                  <View style={{ height: 120, justifyContent: 'flex-end' }}>
                    <View style={{
                      height: Math.max(h, 3),
                      backgroundColor: d.minutes ? theme.primary : theme.border,
                      borderRadius: 6, width: 22,
                    }} />
                  </View>
                  <Text style={[styles.barLabel, { color: theme.textMuted }]}>{day.charAt(0)}</Text>
                  <Text style={[styles.barValue, { color: theme.textMain }]}>{d.minutes}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        <View style={{ height: spacing.xl }} />

        <Text style={[styles.section, { color: theme.textMain }]}>SAT / IELTS Prep Tracker</Text>
        <View style={{ height: 12 }} />

        <PrepCard
          name="SAT"
          progress={prep?.sat_progress || 0}
          onPlus={() => adjust('sat', 5)}
          onMinus={() => adjust('sat', -5)}
        />
        <View style={{ height: 12 }} />
        <PrepCard
          name="IELTS"
          progress={prep?.ielts_progress || 0}
          onPlus={() => adjust('ielts', 5)}
          onMinus={() => adjust('ielts', -5)}
        />

        <View style={{ height: spacing.xl }} />

        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Total Pomodoros</Text>
              <Text style={[styles.statValue, { color: theme.textMain }]}>{summary?.total_sessions ?? 0}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Tasks Completed</Text>
              <Text style={[styles.statValue, { color: theme.textMain }]}>{summary?.completed_tasks ?? 0}/{summary?.total_tasks ?? 0}</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const PrepCard: React.FC<{ name: string; progress: number; onPlus: () => void; onMinus: () => void }> = ({ name, progress, onPlus, onMinus }) => {
  const { theme } = useTheme();
  return (
    <Card>
      <View style={[styles.row, { alignItems: 'center' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.prepName, { color: theme.textMain }]}>{name}</Text>
          <Text style={[styles.statLabel, { color: theme.textMuted }]}>{progress}% complete</Text>
        </View>
        <TouchableOpacity onPress={onMinus} style={[styles.iconBtn, { borderColor: theme.border }]} testID={`${name.toLowerCase()}-minus`}>
          <Minus size={16} color={theme.textMain} />
        </TouchableOpacity>
        <View style={{ width: 8 }} />
        <TouchableOpacity onPress={onPlus} style={[styles.iconBtn, { borderColor: theme.border }]} testID={`${name.toLowerCase()}-plus`}>
          <Plus size={16} color={theme.textMain} />
        </TouchableOpacity>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: theme.surfaceElevated }]}>
        <View style={{ width: `${progress}%`, height: '100%', backgroundColor: theme.primary, borderRadius: 9999 }} />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 18, fontFamily: 'Outfit_700Bold' },
  row: { flexDirection: 'row' },
  section: { fontSize: 18, fontFamily: 'Outfit_600SemiBold', letterSpacing: -0.3 },
  statHead: { marginBottom: 6 },
  statValue: { fontSize: 22, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontFamily: 'Manrope_500Medium', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingVertical: 8 },
  barWrap: { alignItems: 'center', flex: 1 },
  barLabel: { fontSize: 10, fontFamily: 'Manrope_500Medium', marginTop: 6 },
  barValue: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', marginTop: 2 },
  prepName: { fontSize: 17, fontFamily: 'Outfit_600SemiBold' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 8, borderRadius: 9999, marginTop: 12, overflow: 'hidden' },
});
