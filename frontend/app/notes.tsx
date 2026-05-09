import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react-native';
import { useTheme } from '../src/contexts/ThemeContext';
import { Card } from '../src/components/Card';
import { Button } from '../src/components/Button';
import { Input } from '../src/components/Input';
import { api } from '../src/lib/api';
import { spacing, radius } from '../src/theme/colors';

interface Note { id: string; title: string; content: string; subject?: string; updated_at: string; }

export default function NotesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [notes, setNotes] = useState<Note[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

  const load = async () => { try { setNotes(await api<Note[]>('/notes')); } catch {} };
  useFocusEffect(useCallback(() => { load(); }, []));

  const open = (n?: Note) => { setEditing(n || null); setShowEditor(true); };

  const remove = async (n: Note) => {
    Alert.alert('Delete note?', n.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setNotes(prev => prev.filter(x => x.id !== n.id));
        try { await api(`/notes/${n.id}`, { method: 'DELETE' }); } catch {}
      } },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']} testID="notes-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-notes" hitSlop={8}>
          <ArrowLeft size={22} color={theme.textMain} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textMain }]}>Notes</Text>
        <TouchableOpacity onPress={() => open()} testID="add-note-button" hitSlop={8}>
          <Plus size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={notes}
        keyExtractor={n => n.id}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }}
        ListEmptyComponent={
          <Card>
            <Text style={{ color: theme.textMuted, textAlign: 'center', fontFamily: 'Manrope_400Regular', paddingVertical: 12 }}>
              No notes yet. Tap + to write one.
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.85} onPress={() => open(item)}>
            <Card style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.noteTitle, { color: theme.textMain }]} numberOfLines={1}>{item.title || 'Untitled'}</Text>
                  <Text style={[styles.noteBody, { color: theme.textMuted }]} numberOfLines={2}>
                    {item.content || 'Empty note'}
                  </Text>
                  <Text style={[styles.noteMeta, { color: theme.textMuted }]}>
                    {item.subject ? `${item.subject} · ` : ''}{new Date(item.updated_at).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => remove(item)} hitSlop={8} testID={`delete-note-${item.id}`}>
                  <Trash2 size={18} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />

      <NoteEditor
        visible={showEditor}
        note={editing}
        onClose={() => setShowEditor(false)}
        onSaved={(n) => {
          setNotes(prev => {
            const idx = prev.findIndex(x => x.id === n.id);
            if (idx >= 0) { const c = [...prev]; c[idx] = n; return c; }
            return [n, ...prev];
          });
          setShowEditor(false);
        }}
      />
    </SafeAreaView>
  );
}

const NoteEditor: React.FC<{ visible: boolean; note: Note | null; onClose: () => void; onSaved: (n: Note) => void }> = ({ visible, note, onClose, onSaved }) => {
  const { theme } = useTheme();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setTitle(note?.title || '');
      setContent(note?.content || '');
      setSubject(note?.subject || '');
    }
  }, [visible, note]);

  const save = async () => {
    if (!title.trim() && !content.trim()) return Alert.alert('Empty note', 'Add a title or content');
    setSaving(true);
    try {
      let saved: Note;
      if (note) {
        saved = await api(`/notes/${note.id}`, { method: 'PATCH', json: { title, content, subject } });
      } else {
        saved = await api('/notes', { method: 'POST', json: { title, content, subject } });
      }
      onSaved(saved);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalSheet, { backgroundColor: theme.background, borderColor: theme.border, maxHeight: '92%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={[styles.title, { color: theme.textMain }]}>{note ? 'Edit Note' : 'New Note'}</Text>
              <TouchableOpacity onPress={onClose} testID="close-note-editor"><X size={22} color={theme.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              <Input placeholder="Title" value={title} onChangeText={setTitle} testID="note-title-input" />
              <View style={{ height: 12 }} />
              <Input placeholder="Subject" value={subject} onChangeText={setSubject} />
              <View style={{ height: 12 }} />
              <View style={{ alignSelf: 'stretch' }}>
                <Input
                  placeholder="Write something..."
                  value={content}
                  onChangeText={setContent}
                  multiline
                  testID="note-content-input"
                  style={{ height: 220, textAlignVertical: 'top', paddingVertical: 14 }}
                />
              </View>
              <View style={{ height: 16 }} />
              <Button title="Save" onPress={save} loading={saving} testID="save-note-button" />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontFamily: 'Outfit_700Bold' },
  noteTitle: { fontSize: 16, fontFamily: 'Outfit_600SemiBold' },
  noteBody: { fontSize: 13, fontFamily: 'Manrope_400Regular', marginTop: 4, lineHeight: 19 },
  noteMeta: { fontSize: 11, fontFamily: 'Manrope_500Medium', marginTop: 8, letterSpacing: 0.4, textTransform: 'uppercase' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, borderTopWidth: 1 },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#888', opacity: 0.4, marginBottom: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
});
