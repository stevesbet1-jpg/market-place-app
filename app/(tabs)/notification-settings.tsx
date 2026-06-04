/**
 * notification-settings.tsx
 *
 * P2.8 — Notification preference toggles stored in Firestore.
 * Reached from Profile → Preferences → Notifications.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  LuxuryColors,
  LuxurySpacing,
  LuxuryBorderRadius,
  LuxuryFontSize,
} from '../../constants/luxuryTheme';
import { getFirebaseApp } from '../../lib/firebase';
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from '../../lib/userProfile';

interface PrefRow {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
}

const PREF_ROWS: PrefRow[] = [
  {
    key: 'newJourneys',
    label: 'New Journeys',
    description: 'Notify when a creator you follow publishes a new journey',
  },
  {
    key: 'newExperiences',
    label: 'New Experiences',
    description: 'Notify when a creator you follow publishes a new experience',
  },
  {
    key: 'membershipAlerts',
    label: 'Membership Alerts',
    description: 'Renewal reminders and membership status changes',
  },
  {
    key: 'promotions',
    label: 'Promotions & Offers',
    description: 'Special deals, early access, and platform news',
  },
];

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [uid, setUid] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Auth listener
  useEffect(() => {
    const auth = getAuth(getFirebaseApp());
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return unsub;
  }, []);

  // Load prefs once uid is known
  useEffect(() => {
    if (uid === null) return;
    let cancelled = false;
    (async () => {
      const loaded = await getNotificationPrefs(uid);
      if (!cancelled) { setPrefs(loaded); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const handleToggle = useCallback((key: keyof NotificationPrefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!uid) {
      Alert.alert('Not signed in', 'Sign in to save notification preferences.');
      return;
    }
    setSaving(true);
    try {
      await saveNotificationPrefs(uid, prefs);
      setDirty(false);
      Alert.alert('Saved', 'Your notification preferences have been updated.');
    } catch {
      Alert.alert('Error', 'Could not save preferences. Try again.');
    } finally {
      setSaving(false);
    }
  }, [uid, prefs]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={LuxuryColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={LuxuryColors.gold} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + LuxurySpacing.xxl }}
        >
          <Text style={styles.sectionLabel}>Push & Email Alerts</Text>
          {PREF_ROWS.map((row) => (
            <View key={row.key} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowDesc}>{row.description}</Text>
              </View>
              <Switch
                value={prefs[row.key]}
                onValueChange={(v) => handleToggle(row.key, v)}
                trackColor={{ false: LuxuryColors.glassBorder, true: LuxuryColors.gold }}
                thumbColor={LuxuryColors.background}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveBtn, !dirty && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!dirty || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={LuxuryColors.background} size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Preferences</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LuxuryColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LuxurySpacing.lg,
    paddingVertical: LuxurySpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: LuxuryColors.glassBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontSize: LuxuryFontSize.lg,
    fontWeight: '700',
    color: LuxuryColors.textPrimary,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: LuxurySpacing.lg,
    paddingTop: LuxurySpacing.lg,
  },
  sectionLabel: {
    fontSize: LuxuryFontSize.xs,
    fontWeight: '700',
    color: LuxuryColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: LuxurySpacing.md,
    marginTop: LuxurySpacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LuxuryColors.surface,
    borderWidth: 1,
    borderColor: LuxuryColors.glassBorder,
    borderRadius: LuxuryBorderRadius.md,
    padding: LuxurySpacing.md,
    marginBottom: LuxurySpacing.sm,
    gap: LuxurySpacing.md,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '600',
    color: LuxuryColors.textPrimary,
  },
  rowDesc: {
    fontSize: LuxuryFontSize.xs,
    color: LuxuryColors.textSecondary,
    lineHeight: 16,
  },
  saveBtn: {
    backgroundColor: LuxuryColors.gold,
    borderRadius: LuxuryBorderRadius.md,
    paddingVertical: LuxurySpacing.md,
    alignItems: 'center',
    marginTop: LuxurySpacing.xl,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: LuxuryFontSize.md,
    fontWeight: '700',
    color: LuxuryColors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
