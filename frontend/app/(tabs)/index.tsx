import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flame, Timer, BookOpen, Sparkles, BarChart3, FileText, ChevronRight, Plus } from 'lucide-react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { Card } from '../../src/components/Card';
import { api } from '../../src/lib/api';
import { spacing, radius } from '../../src/theme/colors';

interface Task {
  id: string; title: string; type: string; subject?: string; due_date?: string | null; completed: boolean; priority: string;
}
interface Summary {
  total_tasks: number; completed_tasks: number; completion_rate: number;
  weekly_hours: number; weekly_minutes: number; streak_days: number; total_sessions: number;
  daily_minutes: { date: string; minutes: number }[];
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};
const todayLabel = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

export default function HomeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [t, s] = await Promise.all([
        api<Task[]>('/tasks'),
        api<Summary>('/analytics/summary'),
      ]);
      setTasks(t);
      setSummary(s);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const upcoming = tasks.filter(t => !t.completed).slice(0, 4);
  const firstName = (user?.name || 'Student').split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']} testID="home-screen">
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.textMuted} />}
      >
        {/* Header */}
        <Text style={[styles.greeting, { color: theme.textMuted }]}>{greeting()}, {firstName}</Text>
        <Text style={[styles.title, { color: theme.textMain }]}>{todayLabel()}</Text>

        <View style={{ height: spacing.xl }} />

        {/* Stats row */}
        <View style={styles.row}>
          <Card style={{ flex: 1, marginRight: 8 }}>
            <View style={styles.statHeader}>
              <Timer size={16} color={theme.primary} />
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>This Week</Text>
            </View>
            <Text style={[styles.statValue, { color: theme.textMain }]}>{summary?.weekly_hours ?? 0}h</Text>
            <Text style={[styles.statHint, { color: theme.textMuted }]}>focus time</Text>
          </Card>
          <Card style={{ flex: 1, marginLeft: 8 }}>
            <View style={styles.statHeader}>
              <Flame size={16} color={theme.primary} />
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Streak</Text>
            </View>
            <Text style={[styles.statValue, { color: theme.textMain }]}>{summary?.streak_days ?? 0}</Text>
            <Text style={[styles.statHint, { color: theme.textMuted }]}>days in a row</Text>
          </Card>
        </View>

        <View style={{ height: spacing.lg }} />

        {/* Focus card (pomodoro) */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/pomodoro')} testID="focus-card">
          <View style={[styles.focusCard, { backgroundColor: theme.primary }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.focusKicker}>FOCUS NOW</Text>
              <Text style={styles.focusTitle}>Start a 25-min Pomodoro</Text>
              <Text style={styles.focusSub}>Deep-work mode with timer & sounds</Text>
            </View>
            <View style={styles.focusArrow}>
              <ChevronRight size={22} color="#FFF" />
            </View>
          </View>
        </TouchableOpacity>

        <View style={{ height: spacing.xl }} />

        {/* Up next */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Up next</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/planner')} testID="see-all-tasks">
            <Text style={[styles.link, { color: theme.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.textMuted} style={{ marginTop: 20 }} />
        ) : upcoming.length === 0 ? (
          <Card>
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              No upcoming tasks. Tap + in Planner to add one.
            </Text>
          </Card>
        ) : (
          upcoming.map((t) => (
            <Card key={t.id} style={{ marginBottom: 10 }}>
              <View style={styles.taskRow}>
                <View style={[styles.dot, { backgroundColor: typeColor(t.type, theme.primary) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskTitle, { color: theme.textMain }]}>{t.title}</Text>
                  <Text style={[styles.taskMeta, { color: theme.textMuted }]}>
                    {t.type.toUpperCase()}{t.subject ? ` · ${t.subject}` : ''}{t.due_date ? ` · ${t.due_date}` : ''}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}

        <View style={{ height: spacing.xl }} />

        {/* Quick actions */}
        <Text style={[styles.sectionTitle, { color: theme.textMain }]}>Quick actions</Text>
        <View style={{ height: 12 }} />
        <View style={styles.row}>
          <ActionTile
            label="Analytics"
            icon={<BarChart3 size={18} color={theme.primary} />}
            onPress={() => router.push('/analytics')}
            testID="open-analytics"
          />
          <View style={{ width: 12 }} />
          <ActionTile
            label="Notes"
            icon={<FileText size={18} color={theme.primary} />}
            onPress={() => router.push('/notes')}
            testID="open-notes"
          />
        </View>
        <View style={{ height: 12 }} />
        <View style={styles.row}>
          <ActionTile
            label="AI Tutor"
            icon={<Sparkles size={18} color={theme.primary} />}
            onPress={() => router.push('/(tabs)/chatbot')}
            testID="open-chatbot"
          />
          <View style={{ width: 12 }} />
          <ActionTile
            label="Add Task"
            icon={<Plus size={18} color={theme.primary} />}
            onPress={() => router.push('/(tabs)/planner')}
            testID="add-task-quick"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function typeColor(type: string, primary: string) {
  if (type === 'exam') return '#E54D2E';
  if (type === 'assignment') return '#F5A623';
  return primary;
}

const ActionTile: React.FC<{ label: string; icon: React.ReactNode; onPress: () => void; testID?: string }> = ({ label, icon, onPress, testID }) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={{ flex: 1 }} testID={testID}>
      <View style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {icon}
        <Text style={[styles.tileLabel, { color: theme.textMain }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  greeting: { fontSize: 14, fontFamily: 'Manrope_500Medium' },
  title: { fontSize: 24, fontFamily: 'Outfit_700Bold', letterSpacing: -0.4, marginTop: 4 },
  row: { flexDirection: 'row' },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  statLabel: { fontSize: 11, fontFamily: 'Manrope_500Medium', letterSpacing: 0.6, textTransform: 'uppercase', marginLeft: 4 },
  statValue: { fontSize: 28, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  statHint: { fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 2 },
  focusCard: {
    borderRadius: radius.md, padding: 18, flexDirection: 'row', alignItems: 'center',
  },
  focusKicker: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontFamily: 'Manrope_600SemiBold', letterSpacing: 1 },
  focusTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Outfit_700Bold', marginTop: 4, letterSpacing: -0.3 },
  focusSub: { color: 'rgba(255,255,255,0.85)', marginTop: 4, fontSize: 13, fontFamily: 'Manrope_400Regular' },
  focusArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: 'Outfit_600SemiBold', letterSpacing: -0.3 },
  link: { fontSize: 13, fontFamily: 'Manrope_600SemiBold' },
  taskRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  taskTitle: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
  taskMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 2 },
  empty: { textAlign: 'center', fontFamily: 'Manrope_400Regular', paddingVertical: 12 },
  tile: {
    borderWidth: 1, borderRadius: radius.md, padding: 16, gap: 8,
  },
  tileLabel: { fontSize: 14, fontFamily: 'Manrope_600SemiBold', marginTop: 6 },
});
