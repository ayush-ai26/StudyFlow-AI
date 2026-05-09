import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Card } from '../../src/components/Card';
import { api } from '../../src/lib/api';
import { spacing, radius } from '../../src/theme/colors';

interface Task {
  id: string; title: string; type: string; subject?: string; due_date?: string | null; completed: boolean; priority: string;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function ymd(d: Date) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export default function CalendarScreen() {
  const { theme } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState(new Date());
  const [selected, setSelected] = useState(new Date());

  const load = async () => {
    try { setTasks(await api<Task[]>('/tasks')); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const grid = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  const tasksOnDay = useMemo(() => {
    const m: Record<string, Task[]> = {};
    tasks.forEach(t => {
      if (t.due_date) {
        m[t.due_date] = m[t.due_date] || [];
        m[t.due_date].push(t);
      }
    });
    return m;
  }, [tasks]);

  const selectedTasks = tasksOnDay[ymd(selected)] || [];
  const monthLabel = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const prev = () => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1));
  const next = () => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1));

  const todayKey = ymd(new Date());
  const selectedKey = ymd(selected);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']} testID="calendar-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={[styles.kicker, { color: theme.textMuted }]}>CALENDAR</Text>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.textMain }]}>{monthLabel}</Text>
          <View style={styles.navRow}>
            <TouchableOpacity onPress={prev} style={[styles.navBtn, { borderColor: theme.border }]} testID="cal-prev"><ChevronLeft size={18} color={theme.textMain} /></TouchableOpacity>
            <View style={{ width: 8 }} />
            <TouchableOpacity onPress={next} style={[styles.navBtn, { borderColor: theme.border }]} testID="cal-next"><ChevronRight size={18} color={theme.textMain} /></TouchableOpacity>
          </View>
        </View>

        <View style={{ height: spacing.lg }} />

        <Card padding={12}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={[styles.weekday, { color: theme.textMuted }]}>{d}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {grid.map((d, i) => {
              if (!d) return <View key={i} style={styles.cell} />;
              const k = ymd(d);
              const isToday = k === todayKey;
              const isSel = k === selectedKey;
              const has = !!tasksOnDay[k];
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelected(d)}
                  activeOpacity={0.8}
                  style={styles.cell}
                  testID={`day-${k}`}
                >
                  <View style={[
                    styles.cellInner,
                    isSel && { backgroundColor: theme.primary },
                    !isSel && isToday && { borderWidth: 1, borderColor: theme.primary },
                  ]}>
                    <Text style={{
                      color: isSel ? '#FFF' : theme.textMain,
                      fontFamily: 'Manrope_600SemiBold',
                      fontSize: 14,
                    }}>{d.getDate()}</Text>
                  </View>
                  {has ? <View style={[styles.dot, { backgroundColor: isSel ? '#FFF' : theme.primary }]} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <View style={{ height: spacing.xl }} />

        <Text style={[styles.subTitle, { color: theme.textMain }]}>
          {selected.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </Text>
        <View style={{ height: 12 }} />

        {selectedTasks.length === 0 ? (
          <Card>
            <Text style={[styles.empty, { color: theme.textMuted }]}>Nothing scheduled.</Text>
          </Card>
        ) : (
          selectedTasks.map(t => (
            <Card key={t.id} style={{ marginBottom: 10 }}>
              <Text style={[styles.taskTitle, { color: theme.textMain }]}>{t.title}</Text>
              <Text style={[styles.taskMeta, { color: theme.textMuted }]}>
                {t.type.toUpperCase()}{t.subject ? ` · ${t.subject}` : ''} · {t.priority}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  title: { fontSize: 24, fontFamily: 'Outfit_700Bold', letterSpacing: -0.4 },
  subTitle: { fontSize: 16, fontFamily: 'Outfit_600SemiBold' },
  navRow: { flexDirection: 'row' },
  navBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Manrope_600SemiBold', paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 6 },
  cellInner: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  empty: { textAlign: 'center', fontFamily: 'Manrope_400Regular', paddingVertical: 12 },
  taskTitle: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
  taskMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 2 },
});
