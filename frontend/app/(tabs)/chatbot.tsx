import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Send, Sparkles, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { api } from '../../src/lib/api';
import { spacing, radius } from '../../src/theme/colors';

interface Msg { id: string; role: 'user' | 'assistant'; content: string; created_at: string; }

const PROMPTS = [
  'Make a 7-day SAT Math plan',
  'Explain photosynthesis simply',
  'Tips to focus while studying',
  'IELTS Writing Task 2 strategy',
];

export default function ChatbotScreen() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const load = async () => {
    try { setMessages(await api<Msg[]>('/chat/history')); } catch {} finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  const send = async (txt?: string) => {
    const message = (txt ?? input).trim();
    if (!message || sending) return;
    setInput('');
    const optimistic: Msg = { id: `tmp_${Date.now()}`, role: 'user', content: message, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setSending(true);
    try {
      const res = await api<{ user: Msg; assistant: Msg }>('/chat', { method: 'POST', json: { message } });
      setMessages(prev => prev.filter(m => m.id !== optimistic.id).concat([res.user, res.assistant]));
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      Alert.alert('AI error', e.message);
    } finally { setSending(false); }
  };

  const clear = async () => {
    Alert.alert('Clear chat?', 'This will remove all messages.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        try { await api('/chat/history', { method: 'DELETE' }); setMessages([]); } catch {}
      } },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']} testID="chatbot-screen">
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: theme.textMuted }]}>STUDYFLOW AI</Text>
          <Text style={[styles.title, { color: theme.textMain }]}>AI Tutor</Text>
        </View>
        {messages.length > 0 ? (
          <TouchableOpacity onPress={clear} hitSlop={8} testID="clear-chat">
            <Trash2 size={18} color={theme.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 16 }}
        >
          {loading ? (
            <ActivityIndicator color={theme.textMuted} />
          ) : messages.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primary }]}>
                <Sparkles size={28} color="#FFF" />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.textMain }]}>Your study buddy</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Ask anything — concepts, plans, exam prep, motivation.
              </Text>
              <View style={{ height: 16 }} />
              <View style={styles.promptsWrap}>
                {PROMPTS.map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => send(p)}
                    activeOpacity={0.85}
                    style={[styles.prompt, { borderColor: theme.border }]}
                    testID={`prompt-${p.slice(0, 12)}`}
                  >
                    <Text style={{ color: theme.textMain, fontSize: 13, fontFamily: 'Manrope_500Medium' }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            messages.map(m => (
              <View key={m.id} style={[styles.bubbleRow, { justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }]}>
                <View style={[
                  styles.bubble,
                  m.role === 'user'
                    ? { backgroundColor: theme.primary, borderTopRightRadius: 4 }
                    : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderTopLeftRadius: 4 },
                ]}>
                  <Text style={{
                    color: m.role === 'user' ? '#FFF' : theme.textMain,
                    fontFamily: 'Manrope_400Regular',
                    fontSize: 15,
                    lineHeight: 22,
                  }}>{m.content}</Text>
                </View>
              </View>
            ))
          )}
          {sending ? (
            <View style={[styles.bubbleRow, { justifyContent: 'flex-start' }]}>
              <View style={[styles.bubble, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                <ActivityIndicator color={theme.textMuted} size="small" />
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.inputBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            placeholder="Ask anything..."
            placeholderTextColor={theme.textMuted}
            value={input}
            onChangeText={setInput}
            style={[styles.input, { color: theme.textMain }]}
            multiline
            testID="chat-input"
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: !input.trim() || sending ? 0.5 : 1 }]}
            testID="send-message"
          >
            <Send size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  kicker: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.8 },
  title: { fontSize: 24, fontFamily: 'Outfit_700Bold', letterSpacing: -0.4, marginTop: 2 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Outfit_600SemiBold' },
  emptySub: { textAlign: 'center', marginTop: 6, fontFamily: 'Manrope_400Regular', fontSize: 14, paddingHorizontal: 24 },
  promptsWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  prompt: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9999, borderWidth: 1, marginHorizontal: 4, marginBottom: 4 },
  bubbleRow: { flexDirection: 'row', marginVertical: 5 },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 8, gap: 8 },
  input: { flex: 1, minHeight: 40, maxHeight: 120, fontSize: 15, fontFamily: 'Manrope_400Regular', paddingHorizontal: 6, paddingVertical: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
