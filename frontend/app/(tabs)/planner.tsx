import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert, ScrollView,
  KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { Plus, Check, Trash2, X, Sparkles, Share2 } from 'lucide-react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { api } from '../../src/lib/api';
import { spacing, radius } from '../../src/theme/colors';
import { requestPermissions, scheduleTaskReminder } from '../../src/lib/notifications';

interface Task {
  id: string; title: string; description?: string; type: 'task' | 'assignment' | 'exam';
  subject?: string; due_date?: string | null; priority: 'low' | 'medium' | 'high'; completed: boolean;
}

const TYPES: Task['type'][] = ['task', 'assignment', 'exam'];
const PRIORITIES: Task['priority'][] = ['low', 'medium', 'high'];

export default function PlannerScreen() {
  const { theme } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Task['type']>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showAi, setShowAi] = useState(false);

  const load = async () => {
    try { setTasks(await api<Task[]>('/tasks')); } finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const visible = filter === 'all' ? tasks : tasks.filter(t => t.type === filter);

  const toggle = async (t: Task) => {
    const prev = tasks;
    setTasks(tasks.map(x => x.id === t.id ? { ...x, completed: !x.completed } : x));
    try {
      await api(`/tasks/${t.id}`, { method: 'PATCH', json: { completed: !t.completed } });
    } catch { setTasks(prev); }
  };
  const remove = async (t: Task) => {
    const prev = tasks;
    setTasks(tasks.filter(x => x.id !== t.id));
    try { await api(`/tasks/${t.id}`, { method: 'DELETE' }); } catch { setTasks(prev); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']} testID="planner-screen">
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.kicker, { color: theme.textMuted }]}>YOUR PLANNER</Text>
            <Text style={[styles.title, { color: theme.textMain }]}>Tasks & Assignments</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAi(true)}
            activeOpacity={0.85}
            style={[styles.aiBtn, { borderColor: theme.border }]}
            testID="ai-plan-button"
          >
            <Sparkles size={16} color={theme.primary} />
            <Text style={[styles.aiBtnText, { color: theme.textMain }]}>AI Plan</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.lg }} />

        {/* Filter chips */}
        <View style={styles.chips}>
          {(['all', ...TYPES] as const).map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f as any)}
              activeOpacity={0.85}
              style={[
                styles.chip,
                {
                  backgroundColor: filter === f ? theme.primary : 'transparent',
                  borderColor: filter === f ? theme.primary : theme.border,
                },
              ]}
              testID={`filter-${f}`}
            >
              <Text style={{
                color: filter === f ? theme.primaryText : theme.textMuted,
                fontSize: 12, fontFamily: 'Manrope_600SemiBold',
                textTransform: 'capitalize',
              }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        contentContainerStyle={{ padding: spacing.xl, paddingTop: 12, paddingBottom: 120 }}
        data={visible}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !loading ? (
            <Card>
              <Text style={[styles.empty, { color: theme.textMuted }]}>
                Nothing here yet. Tap + to add a task or use AI Plan to auto-fill your week.
              </Text>
            </Card>
          ) : null
        }
        renderItem={({ item }) => (
          <Swipeable
            renderRightActions={() => (
              <TouchableOpacity
                onPress={() => remove(item)}
                style={[styles.swipeAction, { backgroundColor: theme.error }]}
                testID={`swipe-delete-${item.id}`}
              >
                <Trash2 size={20} color="#FFF" />
                <Text style={styles.swipeActionText}>Delete</Text>
              </TouchableOpacity>
            )}
            overshootRight={false}
          >
            <Card style={{ marginBottom: 10 }}>
              <View style={styles.taskRow}>
                <TouchableOpacity
                  onPress={() => toggle(item)}
                  activeOpacity={0.8}
                  style={[
                    styles.checkbox,
                    { borderColor: item.completed ? theme.primary : theme.border, backgroundColor: item.completed ? theme.primary : 'transparent' },
                  ]}
                  testID={`toggle-${item.id}`}
                >
                  {item.completed ? <Check size={16} color="#FFF" /> : null}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskTitle, { color: theme.textMain, textDecorationLine: item.completed ? 'line-through' : 'none', opacity: item.completed ? 0.6 : 1 }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.taskMeta, { color: theme.textMuted }]}>
                    {item.type.toUpperCase()}{item.subject ? ` · ${item.subject}` : ''}{item.due_date ? ` · ${item.due_date}` : ''} · {item.priority}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => remove(item)} hitSlop={8} testID={`delete-${item.id}`}>
                  <Trash2 size={18} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </Card>
          </Swipeable>
        )}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => setShowAdd(true)}
        activeOpacity={0.85}
        testID="add-task-fab"
      >
        <Plus size={24} color="#FFF" />
      </TouchableOpacity>

      <AddTaskModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={(t) => { setTasks([t, ...tasks]); setShowAdd(false); }}
      />
      <AiPlanModal
        visible={showAi}
        onClose={() => setShowAi(false)}
        onApply={(items) => { setTasks([...items, ...tasks]); setShowAi(false); }}
      />
    </SafeAreaView>
  );
}

const AddTaskModal: React.FC<{ visible: boolean; onClose: () => void; onCreated: (t: Task) => void }> = ({ visible, onClose, onCreated }) => {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [type, setType] = useState<Task['type']>('task');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setSubject(''); setType('task'); setPriority('medium'); setDueDate(''); };

  const save = async () => {
    if (!title.trim()) return Alert.alert('Title required');
    setSaving(true);
    try {
      const t = await api<Task>('/tasks', { method: 'POST', json: { title, subject, type, priority, due_date: dueDate || null } });
      // Schedule local notification reminder if there's a future due date
      if (dueDate) {
        const ok = await requestPermissions();
        if (ok) await scheduleTaskReminder(t.id, t.title, dueDate);
      }
      reset();
      onCreated(t);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalSheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>New Task</Text>
              <TouchableOpacity onPress={onClose} testID="close-add-task"><X size={22} color={theme.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              <Input testID="task-title-input" placeholder="What do you need to do?" value={title} onChangeText={setTitle} />
              <View style={{ height: 12 }} />
              <Input testID="task-subject-input" placeholder="Subject (e.g., Math)" value={subject} onChangeText={setSubject} />
              <View style={{ height: 12 }} />
              <Input testID="task-due-input" placeholder="Due date (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} />

              <Text style={[styles.label, { color: theme.textMuted }]}>TYPE</Text>
              <View style={styles.chips}>
                {TYPES.map(t => (
                  <TouchableOpacity key={t} onPress={() => setType(t)} style={[styles.chip, { borderColor: type === t ? theme.primary : theme.border, backgroundColor: type === t ? theme.primary : 'transparent' }]}>
                    <Text style={{ color: type === t ? theme.primaryText : theme.textMuted, fontSize: 12, fontFamily: 'Manrope_600SemiBold', textTransform: 'capitalize' }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.label, { color: theme.textMuted }]}>PRIORITY</Text>
              <View style={styles.chips}>
                {PRIORITIES.map(p => (
                  <TouchableOpacity key={p} onPress={() => setPriority(p)} style={[styles.chip, { borderColor: priority === p ? theme.primary : theme.border, backgroundColor: priority === p ? theme.primary : 'transparent' }]}>
                    <Text style={{ color: priority === p ? theme.primaryText : theme.textMuted, fontSize: 12, fontFamily: 'Manrope_600SemiBold', textTransform: 'capitalize' }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ height: 16 }} />
              <Button title="Save Task" onPress={save} loading={saving} testID="save-task-button" />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const AiPlanModal: React.FC<{ visible: boolean; onClose: () => void; onApply: (t: Task[]) => void }> = ({ visible, onClose, onApply }) => {
  const { theme } = useTheme();
  const [goal, setGoal] = useState('');
  const [hours, setHours] = useState('3');
  const [days, setDays] = useState('7');
  const [subjects, setSubjects] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any[] | null>(null);

  const generate = async () => {
    if (!goal.trim()) return Alert.alert('Goal required');
    setLoading(true);
    try {
      const res = await api<{ plan: any[] }>('/ai/schedule', {
        method: 'POST',
        json: {
          goal,
          available_hours_per_day: parseInt(hours) || 3,
          days: parseInt(days) || 7,
          subjects: subjects.split(',').map(s => s.trim()).filter(Boolean),
        },
      });
      setPlan(res.plan || []);
    } catch (e: any) { Alert.alert('AI error', e.message); }
    finally { setLoading(false); }
  };

  const apply = async () => {
    if (!plan) return;
    setLoading(true);
    try {
      const created: Task[] = [];
      for (const p of plan) {
        const t = await api<Task>('/tasks', {
          method: 'POST',
          json: {
            title: p.title || `Day ${p.day}`,
            subject: p.subject || '',
            type: 'task',
            priority: 'medium',
            description: p.focus || '',
          },
        });
        created.push(t);
      }
      onApply(created);
      setPlan(null); setGoal(''); setSubjects('');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalSheet, { backgroundColor: theme.background, borderColor: theme.border, maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textMain }]}>AI Study Plan</Text>
              <TouchableOpacity onPress={onClose} testID="close-ai-plan"><X size={22} color={theme.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView>
              {!plan ? (
                <>
                  <Input testID="ai-goal-input" placeholder="Goal (e.g., Ace SAT Math by July)" value={goal} onChangeText={setGoal} multiline />
                  <View style={{ height: 12 }} />
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Input placeholder="Hours/day" keyboardType="numeric" value={hours} onChangeText={setHours} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Input placeholder="Days" keyboardType="numeric" value={days} onChangeText={setDays} />
                    </View>
                  </View>
                  <View style={{ height: 12 }} />
                  <Input placeholder="Subjects (comma separated)" value={subjects} onChangeText={setSubjects} />
                  <View style={{ height: 16 }} />
                  <Button title="Generate Plan" onPress={generate} loading={loading} testID="generate-plan-button" />
                </>
              ) : (
                <>
                  {plan.map((p, i) => (
                    <Card key={i} style={{ marginBottom: 10 }}>
                      <Text style={[styles.taskTitle, { color: theme.textMain }]}>Day {p.day}: {p.title}</Text>
                      <Text style={[styles.taskMeta, { color: theme.textMuted }]}>
                        {p.subject || 'Study'} · {p.duration_minutes || 60} min
                      </Text>
                      {p.focus ? <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>{p.focus}</Text> : null}
                    </Card>
                  ))}
                  <View style={{ height: 12 }} />
                  <Button title="Add to Planner" onPress={apply} loading={loading} testID="apply-plan-button" />
                  <View style={{ height: 8 }} />
                  <Button
                    title="Share Plan"
                    variant="secondary"
                    icon={<Share2 size={18} color={theme.textMain} />}
                    onPress={async () => {
                      const text = `My StudyFlow AI Plan — ${goal}\n\n` +
                        plan.map(p => `Day ${p.day}: ${p.title}${p.subject ? ` (${p.subject})` : ''} · ${p.duration_minutes || 60} min${p.focus ? `\n   ${p.focus}` : ''}`).join('\n');
                      try { await Share.share({ message: text }); } catch {}
                    }}
                    testID="share-plan-button"
                  />
                  <View style={{ height: 8 }} />
                  <Button title="Generate Different Plan" variant="secondary" onPress={() => setPlan(null)} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.8 },
  title: { fontSize: 24, fontFamily: 'Outfit_700Bold', letterSpacing: -0.4, marginTop: 2 },
  aiBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: 9999, borderWidth: 1 },
  aiBtnText: { fontSize: 13, fontFamily: 'Manrope_600SemiBold', marginLeft: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 9999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  taskTitle: { fontSize: 15, fontFamily: 'Manrope_600SemiBold' },
  taskMeta: { fontSize: 12, fontFamily: 'Manrope_400Regular', marginTop: 2 },
  empty: { textAlign: 'center', fontFamily: 'Manrope_400Regular', paddingVertical: 12 },
  fab: {
    position: 'absolute', right: 20, bottom: Platform.OS === 'ios' ? 100 : 80,
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
  },
  swipeAction: {
    width: 88, marginBottom: 10, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },
  swipeActionText: { color: '#FFF', fontSize: 11, fontFamily: 'Manrope_600SemiBold', marginTop: 4 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, borderTopWidth: 1 },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#888', opacity: 0.4, marginBottom: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontFamily: 'Outfit_700Bold' },
  label: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.6, marginTop: 16 },
});
