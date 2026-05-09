import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogOut, Moon, Sun, Bell, BarChart3, FileText, ChevronRight, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { spacing, radius } from '../../src/theme/colors';
import { requestPermissions } from '../../src/lib/notifications';

export default function ProfileScreen() {
  const { theme, mode, setMode } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [notifEnabled, setNotifEnabled] = React.useState(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']} testID="profile-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }}>
        <Text style={[styles.kicker, { color: theme.textMuted }]}>PROFILE</Text>
        <Text style={[styles.title, { color: theme.textMain }]}>Settings</Text>

        <View style={{ height: spacing.xl }} />

        <Card>
          <View style={styles.userRow}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#FFF', fontFamily: 'Outfit_700Bold', fontSize: 22 }}>
                  {(user?.name || 'S').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.name, { color: theme.textMain }]}>{user?.name || 'Student'}</Text>
              <Text style={[styles.email, { color: theme.textMuted }]}>
                {user?.is_guest ? 'Guest mode · sign in to sync' : user?.email}
              </Text>
            </View>
            {user?.is_guest ? (
              <View style={[styles.guestBadge, { borderColor: theme.border }]}>
                <Text style={{ color: theme.textMuted, fontSize: 11, fontFamily: 'Manrope_600SemiBold' }}>GUEST</Text>
              </View>
            ) : null}
          </View>
        </Card>

        <View style={{ height: spacing.lg }} />

        <Text style={[styles.section, { color: theme.textMuted }]}>APPEARANCE</Text>
        <Card>
          <SettingRow
            icon={<Sun size={18} color={theme.textMuted} />}
            label="Light"
            right={mode === 'light' ? <Dot /> : null}
            onPress={() => setMode('light')}
            testID="theme-light"
          />
          <Divider />
          <SettingRow
            icon={<Moon size={18} color={theme.textMuted} />}
            label="Dark"
            right={mode === 'dark' ? <Dot /> : null}
            onPress={() => setMode('dark')}
            testID="theme-dark"
          />
          <Divider />
          <SettingRow
            icon={<Sparkles size={18} color={theme.textMuted} />}
            label="System"
            right={mode === 'system' ? <Dot /> : null}
            onPress={() => setMode('system')}
            testID="theme-system"
          />
        </Card>

        <View style={{ height: spacing.lg }} />

        <Text style={[styles.section, { color: theme.textMuted }]}>NOTIFICATIONS</Text>
        <Card>
          <View style={styles.row}>
            <View style={styles.left}>
              <Bell size={18} color={theme.textMuted} />
              <Text style={[styles.label, { color: theme.textMain }]}>Study reminders</Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={async (v) => {
                if (v) {
                  const ok = await requestPermissions();
                  if (!ok) {
                    Alert.alert('Permission needed', 'Enable notifications in your device settings to receive study reminders.');
                    return;
                  }
                }
                setNotifEnabled(v);
              }}
              testID="notif-switch"
            />
          </View>
        </Card>

        <View style={{ height: spacing.lg }} />

        <Text style={[styles.section, { color: theme.textMuted }]}>QUICK LINKS</Text>
        <Card>
          <SettingRow
            icon={<BarChart3 size={18} color={theme.textMuted} />}
            label="Analytics & Prep"
            right={<ChevronRight size={18} color={theme.textMuted} />}
            onPress={() => router.push('/analytics')}
            testID="link-analytics"
          />
          <Divider />
          <SettingRow
            icon={<FileText size={18} color={theme.textMuted} />}
            label="My Notes"
            right={<ChevronRight size={18} color={theme.textMuted} />}
            onPress={() => router.push('/notes')}
            testID="link-notes"
          />
        </Card>

        <View style={{ height: spacing.xxl }} />
        <Button
          title="Sign out"
          variant="secondary"
          icon={<LogOut size={18} color={theme.textMain} />}
          onPress={async () => {
            await signOut();
            router.replace('/login');
          }}
          testID="sign-out-button"
        />
        <View style={{ height: 16 }} />
        <Text style={[styles.foot, { color: theme.textMuted }]}>StudyFlow AI · v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const Dot = () => {
  const { theme } = useTheme();
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary }} />;
};

const Divider = () => {
  const { theme } = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 4 }} />;
};

const SettingRow: React.FC<{
  icon: React.ReactNode; label: string; right?: React.ReactNode; onPress?: () => void; testID?: string;
}> = ({ icon, label, right, onPress, testID }) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.row} testID={testID}>
      <View style={styles.left}>{icon}<Text style={[styles.label, { color: theme.textMain }]}>{label}</Text></View>
      {right}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  kicker: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.8 },
  title: { fontSize: 24, fontFamily: 'Outfit_700Bold', letterSpacing: -0.4, marginTop: 2 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  name: { fontSize: 18, fontFamily: 'Outfit_700Bold' },
  email: { fontSize: 13, fontFamily: 'Manrope_400Regular', marginTop: 2 },
  guestBadge: { borderWidth: 1, paddingHorizontal: 10, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 11, fontFamily: 'Manrope_600SemiBold', letterSpacing: 0.8, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 15, fontFamily: 'Manrope_500Medium', marginLeft: 12 },
  foot: { textAlign: 'center', fontSize: 12, fontFamily: 'Manrope_400Regular' },
});
