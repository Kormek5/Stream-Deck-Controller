import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const { width: SW } = Dimensions.get("window");

function getApiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  if (Platform.OS === "web") return "/api";
  return "http://localhost:3001/api";
}

type Screenshot = { data: string | null; timestamp: number | null };
type SystemStats = {
  cpu?: number;
  ram?: number;
  ramTotal?: number;
  temp?: number;
  uptime?: number;
};
type AgentInfo = { id: string; platform: string; hostname: string };

function formatUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}ч ${m}м`;
}

function StatBadge({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={statStyles.badge}>
      <Ionicons name={icon as any} size={14} color={color} />
      <View>
        <Text style={statStyles.badgeLabel}>{label}</Text>
        <Text style={[statStyles.badgeValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

const statStyles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  badgeLabel: { fontSize: 10, color: "#90a0b7", fontWeight: "600" },
  badgeValue: { fontSize: 13, fontWeight: "700" },
});

export default function RemoteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [screenshot, setScreenshot] = useState<Screenshot>({ data: null, timestamp: null });
  const [systemStats, setSystemStats] = useState<SystemStats>({});
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [clickFlash, setClickFlash] = useState<{ x: number; y: number } | null>(null);
  const [showStats, setShowStats] = useState(true);

  const containerWidth = SW - 24;
  const containerRef = useRef<View>(null);
  const imageLayoutRef = useRef({ width: containerWidth, height: containerWidth * (9 / 16) });
  const lastMouseSend = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScreenshot = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/screenshot/latest`);
      const json: Screenshot = await r.json();
      if (json.data) setScreenshot(json);
    } catch { /* ignore */ }
  }, []);

  const fetchStats = useCallback(async () => {
    // System stats are only available via SSE stream (not REST)
    // Stats are populated when agent sends them through the stream
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const r = await fetch(`${getApiBase()}/agents`);
      if (r.ok) {
        const json = await r.json();
        setAgents(json.agents ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const startStream = useCallback(async () => {
    try {
      await fetch(`${getApiBase()}/monitor/stream/start`, { method: "POST" });
      setStreaming(true);
    } catch { /* ignore */ }
  }, []);

  const stopStream = useCallback(async () => {
    try {
      await fetch(`${getApiBase()}/monitor/stream/stop`, { method: "POST" });
      setStreaming(false);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAgents();
      fetchScreenshot();
      startStream();

      pollRef.current = setInterval(fetchScreenshot, 800);
      statsRef.current = setInterval(fetchStats, 3000);
      agentRef.current = setInterval(fetchAgents, 5000);

      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (statsRef.current) clearInterval(statsRef.current);
        if (agentRef.current) clearInterval(agentRef.current);
        stopStream();
      };
    }, [fetchScreenshot, fetchStats, fetchAgents, startStream, stopStream])
  );

  const sendMouse = useCallback(
    async (type: string, normX: number, normY: number, button = "left") => {
      try {
        await fetch(`${getApiBase()}/monitor/mouse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, x: normX, y: normY, button }),
        });
      } catch { /* ignore */ }
    },
    []
  );

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      const { width, height } = imageLayoutRef.current;
      const normX = Math.max(0, Math.min(1, locationX / width));
      const normY = Math.max(0, Math.min(1, locationY / height));
      setClickFlash({ x: locationX, y: locationY });
      setTimeout(() => setClickFlash(null), 300);
      sendMouse("mouse-click", normX, normY);
    },
    onPanResponderMove: (e) => {
      const now = Date.now();
      if (now - lastMouseSend.current < 80) return;
      lastMouseSend.current = now;
      const { locationX, locationY } = e.nativeEvent;
      const { width, height } = imageLayoutRef.current;
      const normX = Math.max(0, Math.min(1, locationX / width));
      const normY = Math.max(0, Math.min(1, locationY / height));
      sendMouse("mouse-move", normX, normY);
    },
  });

  const imgUri = screenshot.data
    ? screenshot.data.startsWith("data:")
      ? screenshot.data
      : `data:image/png;base64,${screenshot.data}`
    : null;

  const agentConnected = agents.length > 0;
  const agent = agents[0];
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
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
        <View style={styles.headerLeft}>
          <View style={[styles.dot, { backgroundColor: agentConnected ? "#22c55e" : "#ef4444" }]} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {agentConnected ? agent?.hostname ?? "Агент" : "Нет агента"}
          </Text>
          {agentConnected && agent?.platform && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              ({agent.platform})
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setShowStats((v) => !v)}
            style={[styles.iconBtn, { borderColor: colors.border }]}
          >
            <Ionicons
              name="stats-chart-outline"
              size={16}
              color={showStats ? colors.primary : colors.mutedForeground}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={streaming ? stopStream : startStream}
            style={[
              styles.iconBtn,
              {
                borderColor: streaming ? colors.primary : colors.border,
                backgroundColor: streaming ? `${colors.primary}20` : "transparent",
              },
            ]}
          >
            <Ionicons
              name={streaming ? "pause-circle-outline" : "play-circle-outline"}
              size={16}
              color={streaming ? colors.primary : colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, Platform.OS === "web" && { paddingBottom: 34 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Screenshot */}
        <View style={styles.screenWrap}>
          <View
            ref={containerRef}
            style={[styles.screenContainer, { borderColor: colors.border }]}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              imageLayoutRef.current = { width, height };
            }}
            {...panResponder.panHandlers}
          >
            {imgUri ? (
              <Image
                source={{ uri: imgUri }}
                style={styles.screenshot}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.noScreenshot}>
                {agentConnected ? (
                  <>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.noScreenshotText, { color: colors.mutedForeground }]}>
                      Ожидание скриншота…
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="desktop-outline" size={48} color={colors.mutedForeground} />
                    <Text style={[styles.noScreenshotText, { color: colors.mutedForeground }]}>
                      Агент не подключён
                    </Text>
                    <Text style={[styles.noScreenshotSub, { color: colors.mutedForeground }]}>
                      Запустите агент на ПК
                    </Text>
                  </>
                )}
              </View>
            )}

            {/* Click flash */}
            {clickFlash && (
              <View
                pointerEvents="none"
                style={[
                  styles.clickRipple,
                  { left: clickFlash.x - 20, top: clickFlash.y - 20 },
                ]}
              />
            )}

            {/* Live badge */}
            {streaming && imgUri && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>

          {/* Last updated */}
          {screenshot.timestamp && (
            <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>
              Обновлено: {new Date(screenshot.timestamp).toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* Touch hint */}
        {imgUri && (
          <View style={[styles.hintBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="hand-left-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Нажатие = клик мышью · Перемещение = движение курсора
            </Text>
          </View>
        )}

        {/* System stats */}
        {showStats && agentConnected && (
          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statsTitle, { color: colors.mutedForeground }]}>СИСТЕМА</Text>
            <View style={styles.statsRow}>
              {systemStats.cpu !== undefined && (
                <StatBadge
                  icon="speedometer-outline"
                  label="CPU"
                  value={`${systemStats.cpu.toFixed(0)}%`}
                  color={systemStats.cpu > 80 ? "#ef4444" : systemStats.cpu > 50 ? "#f97316" : "#22c55e"}
                />
              )}
              {systemStats.ram !== undefined && systemStats.ramTotal !== undefined && (
                <StatBadge
                  icon="hardware-chip-outline"
                  label="RAM"
                  value={`${systemStats.ram.toFixed(0)}/${systemStats.ramTotal.toFixed(0)} ГБ`}
                  color={colors.primary}
                />
              )}
              {systemStats.temp !== undefined && (
                <StatBadge
                  icon="thermometer-outline"
                  label="ТЕМП"
                  value={`${systemStats.temp.toFixed(0)}°C`}
                  color={systemStats.temp > 80 ? "#ef4444" : "#f97316"}
                />
              )}
              {systemStats.uptime !== undefined && (
                <StatBadge
                  icon="time-outline"
                  label="UPTIME"
                  value={formatUptime(systemStats.uptime)}
                  color={colors.mutedForeground}
                />
              )}
              {Object.keys(systemStats).length === 0 && (
                <Text style={[styles.noStats, { color: colors.mutedForeground }]}>
                  Данные о системе недоступны
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Mouse controls */}
        {agentConnected && (
          <View style={[styles.controlsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statsTitle, { color: colors.mutedForeground }]}>УПРАВЛЕНИЕ</Text>
            <View style={styles.controlsRow}>
              <ControlBtn
                icon="arrow-back-outline"
                label="Назад"
                colors={colors}
                onPress={() => fetch(`${getApiBase()}/buttons`, { method: "GET" })}
              />
              <ControlBtn
                icon="arrow-up-outline"
                label="Прокрутить вверх"
                colors={colors}
                onPress={() => sendMouse("mouse-scroll", 0.5, 0.5, "up")}
              />
              <ControlBtn
                icon="arrow-down-outline"
                label="Прокрутить вниз"
                colors={colors}
                onPress={() => sendMouse("mouse-scroll", 0.5, 0.5, "down")}
              />
              <ControlBtn
                icon="swap-horizontal-outline"
                label="ПКМ"
                colors={colors}
                onPress={() => sendMouse("mouse-click", 0.5, 0.5, "right")}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

type ColorsType = { secondary: string; border: string; foreground: string; mutedForeground: string };

function ControlBtn({
  icon,
  label,
  colors,
  onPress,
}: {
  icon: string;
  label: string;
  colors: ColorsType;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[ctrlStyles.btn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
      activeOpacity={0.7}
    >
      <Ionicons name={icon as any} size={20} color={colors.foreground} />
      <Text style={[ctrlStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const ctrlStyles = StyleSheet.create({
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  label: { fontSize: 9, fontWeight: "600", textAlign: "center" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerRight: { flexDirection: "row", gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  headerSub: { fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 12, gap: 12 },
  screenWrap: { gap: 6 },
  screenContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  screenshot: { width: "100%", height: "100%" },
  noScreenshot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  noScreenshotText: { fontSize: 14, fontWeight: "600" },
  noScreenshotSub: { fontSize: 12 },
  clickRipple: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(51,153,255,0.4)",
    borderWidth: 2,
    borderColor: "#3399ff",
  },
  liveBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239,68,68,0.85)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  liveText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  timestamp: { fontSize: 11, textAlign: "right", paddingRight: 4 },
  hintBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  hintText: { fontSize: 12, flex: 1 },
  statsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  statsTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  noStats: { fontSize: 13, paddingVertical: 4 },
  controlsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 8,
  },
});
