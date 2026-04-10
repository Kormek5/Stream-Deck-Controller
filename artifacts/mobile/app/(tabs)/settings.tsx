import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function getApiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  if (Platform.OS === "web") return "/api";
  return "http://localhost:3001/api";
}

function InfoRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value?: string;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Ionicons
        name={icon as any}
        size={18}
        color={accent ? colors.primary : colors.mutedForeground}
        style={{ marginRight: 12 }}
      />
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
        {value && (
          <Text style={[styles.infoValue, { color: accent ? colors.primary : colors.foreground }]}>
            {value}
          </Text>
        )}
      </View>
    </View>
  );
}

function SectionTitle({ text }: { text: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{text.toUpperCase()}</Text>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const healthQ = useQuery({
    queryKey: ["health"],
    queryFn: () => fetch(`${getApiBase()}/healthz`).then((r) => r.json()),
    retry: false,
    refetchInterval: 10000,
  });

  const statsQ = useQuery<{ totalButtons: number; totalProfiles: number; totalExecutions: number }>({
    queryKey: ["stats"],
    queryFn: () => fetch(`${getApiBase()}/stats`).then((r) => r.json()),
    retry: false,
  });

  const isConnected = healthQ.isSuccess;
  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "не задан";
  const apiBase = getApiBase();
  const agentUrl = `${apiBase.replace("/api", "")}/streamdeck-agent.zip`;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={Platform.OS === "web" ? { paddingBottom: 34 } : undefined}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Настройки</Text>
      </View>

      <View style={styles.body}>
        <SectionTitle text="Соединение" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <InfoRow
            icon={isConnected ? "cloud-done-outline" : "cloud-offline-outline"}
            label="Статус API"
            value={isConnected ? "Подключено" : "Нет соединения"}
            accent={isConnected}
          />
          <InfoRow icon="globe-outline" label="Домен" value={domain} />
        </View>

        <SectionTitle text="Статистика" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <InfoRow
            icon="grid-outline"
            label="Кнопок"
            value={statsQ.data ? String(statsQ.data.totalButtons) : "…"}
          />
          <InfoRow
            icon="person-outline"
            label="Профилей"
            value={statsQ.data ? String(statsQ.data.totalProfiles) : "…"}
          />
          <InfoRow
            icon="flash-outline"
            label="Выполнено действий"
            value={statsQ.data ? String(statsQ.data.totalExecutions) : "…"}
          />
        </View>

        <SectionTitle text="Локальный агент" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.agentInfo, { borderBottomColor: colors.border }]}>
            <Ionicons name="desktop-outline" size={18} color={colors.mutedForeground} style={{ marginRight: 12, marginTop: 2 }} />
            <Text style={[styles.agentText, { color: colors.mutedForeground }]}>
              Для выполнения системных команд на вашем ПК установите локальный агент. Он запускается в фоне и принимает команды от сервера.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => Linking.openURL(agentUrl)}
            style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={16} color="#fff" />
            <Text style={styles.downloadText}>Скачать агент (Windows / macOS)</Text>
          </TouchableOpacity>
        </View>

        <SectionTitle text="О приложении" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <InfoRow icon="information-circle-outline" label="Версия" value="1.0.0" />
          <InfoRow icon="code-slash-outline" label="Платформа" value={Platform.OS} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: "700" },
  body: { padding: 16, gap: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: "600" },
  agentInfo: {
    flexDirection: "row",
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  agentText: { flex: 1, fontSize: 13, lineHeight: 19 },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  downloadText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
