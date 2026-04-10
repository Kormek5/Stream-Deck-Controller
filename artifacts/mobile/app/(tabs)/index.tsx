import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProfile } from "@/context/ProfileContext";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLS = 3;
const H_PADDING = 12;
const GAP = 8;
const TILE_SIZE = (SCREEN_WIDTH - H_PADDING * 2 - GAP * (COLS - 1)) / COLS;

function getApiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  if (Platform.OS === "web") return "/api";
  return "http://localhost:3001/api";
}

const ACTION_ICONS: Record<string, string> = {
  url: "globe-outline", hotkey: "keypad-outline", script: "terminal-outline",
  app: "apps-outline", media: "play-circle-outline", system: "desktop-outline",
  clipboard: "clipboard-outline", type: "text-outline", notification: "notifications-outline",
  spotify: "musical-notes-outline", yandexmusic: "musical-notes-outline",
  discord: "logo-discord", zoom: "videocam-outline", teams: "people-outline",
  slack: "chatbubbles-outline", telegram: "paper-plane-outline", obs: "radio-outline",
  github: "logo-github", youtube: "logo-youtube", twitch: "logo-twitch",
  vscode: "code-slash-outline", chatgpt: "sparkles-outline",
  steam: "game-controller-outline", vpn: "shield-checkmark-outline",
  wol: "wifi-outline", wallpaperengine: "image-outline", multi: "layers-outline",
  googlemeet: "videocam-outline", gmail: "mail-outline", whatsapp: "logo-whatsapp",
  x: "logo-twitter", notion: "document-text-outline", figma: "color-palette-outline",
  browser: "globe-outline", airdrop: "send-outline", hotkey2: "keyboard-outline",
};

const BUTTON_COLORS: Record<string, string> = {
  teal: "#14b8a6", purple: "#a855f7", orange: "#f97316", red: "#ef4444",
  green: "#22c55e", blue: "#3b82f6", pink: "#ec4899", yellow: "#eab308", slate: "#334155",
};

type SDButton = {
  id: number; profileId: number; folderId: number | null;
  label: string; icon: string; color: string; actionType: string;
  actionValue: string; position: number; executeCount: number;
};
type SDFolder = {
  id: number; profileId: number; name: string; color: string; icon: string; position: number;
};
type Profile = { id: number; name: string; icon: string; isDefault: boolean; createdAt: string };

function getButtonBg(color: string) {
  if (BUTTON_COLORS[color]) return BUTTON_COLORS[color];
  if (color.startsWith("#")) return color;
  return "#1e2635";
}

function getActionIcon(actionType: string): string {
  return (ACTION_ICONS[actionType] as string) ?? "grid-outline";
}

function AnimatedTile({
  children,
  onPress,
  bg,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  bg: string;
  style?: object;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(withSpring(0.88, { damping: 12 }), withSpring(1, { damping: 12 }));
    onPress();
  };

  return (
    <Animated.View style={[animStyle, { width: TILE_SIZE, height: TILE_SIZE }, style]}>
      <Pressable
        onPress={handlePress}
        style={[styles.tile, { backgroundColor: bg, borderRadius: 12 }]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function ButtonTile({ btn, profileId }: { btn: SDButton; profileId: number }) {
  const colors = useColors();
  const qc = useQueryClient();
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);

  const exec = useMutation({
    mutationFn: () =>
      fetch(`${getApiBase()}/buttons/${btn.id}/execute`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      setFlash("ok");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => setFlash(null), 600);
      qc.invalidateQueries({ queryKey: ["buttons", profileId] });
    },
    onError: () => {
      setFlash("err");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setFlash(null), 600);
    },
  });

  const bg = getButtonBg(btn.color);
  const overlayBg =
    flash === "ok" ? "rgba(34,197,94,0.4)" : flash === "err" ? "rgba(239,68,68,0.4)" : "transparent";

  return (
    <AnimatedTile bg={bg} onPress={() => exec.mutate()}>
      {flash && <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayBg, borderRadius: 12 }]} />}
      <Ionicons
        name={getActionIcon(btn.actionType) as any}
        size={28}
        color="rgba(255,255,255,0.9)"
        style={{ marginBottom: 6 }}
      />
      <Text style={[styles.tileLabel, { color: "rgba(255,255,255,0.95)" }]} numberOfLines={2}>
        {btn.label.toUpperCase()}
      </Text>
      {exec.isPending && (
        <ActivityIndicator size="small" color="#fff" style={StyleSheet.absoluteFill} />
      )}
    </AnimatedTile>
  );
}

function FolderTile({
  folder,
  buttonCount,
  onEnter,
}: {
  folder: SDFolder;
  buttonCount: number;
  onEnter: () => void;
}) {
  const bg = getButtonBg(folder.color);
  return (
    <AnimatedTile bg={bg} onPress={onEnter}>
      <Ionicons name="folder-open-outline" size={28} color="rgba(255,255,255,0.9)" style={{ marginBottom: 4 }} />
      <Text style={[styles.tileLabel, { color: "rgba(255,255,255,0.95)" }]} numberOfLines={2}>
        {folder.name.toUpperCase()}
      </Text>
      <Text style={styles.tileSub}>{buttonCount} кнопок</Text>
      <Ionicons
        name="chevron-forward"
        size={12}
        color="rgba(255,255,255,0.5)"
        style={{ position: "absolute", bottom: 6, right: 6 }}
      />
    </AnimatedTile>
  );
}

function ProfilePicker({
  profiles,
  selectedId,
  onSelect,
}: {
  profiles: Profile[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const selected = profiles.find((p) => p.id === selectedId);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.profileBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.75}
      >
        <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.profileName, { color: colors.foreground }]}>
          {selected?.name ?? "Выбрать профиль"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.mutedForeground }]}>ПРОФИЛЬ</Text>
            {profiles.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => { onSelect(p.id); setOpen(false); }}
                style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerRowText, { color: colors.foreground }]}>{p.name}</Text>
                {p.id === selectedId && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default function DeckScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedProfileId, setSelectedProfileId, currentFolderId, setCurrentFolderId } = useProfile();

  const profilesQ = useQuery<Profile[]>({
    queryKey: ["profiles"],
    queryFn: () => fetch(`${getApiBase()}/profiles`).then((r) => r.json()),
    onSuccess: (data) => {
      if (!selectedProfileId && data.length > 0) {
        const def = data.find((p) => p.isDefault) ?? data[0];
        setSelectedProfileId(def.id);
      }
    },
  } as any);

  const profiles = profilesQ.data ?? [];

  const activeProfileId = selectedProfileId ?? profiles[0]?.id ?? null;

  const buttonsQ = useQuery<SDButton[]>({
    queryKey: ["buttons", activeProfileId],
    queryFn: () =>
      fetch(`${getApiBase()}/profiles/${activeProfileId}/buttons`).then((r) => r.json()),
    enabled: activeProfileId != null,
  });

  const foldersQ = useQuery<SDFolder[]>({
    queryKey: ["folders", activeProfileId],
    queryFn: () =>
      fetch(`${getApiBase()}/profiles/${activeProfileId}/folders`).then((r) => r.json()),
    enabled: activeProfileId != null,
  });

  const allButtons = buttonsQ.data ?? [];
  const allFolders = foldersQ.data ?? [];

  const isLoading = buttonsQ.isLoading || foldersQ.isLoading;
  const isError = buttonsQ.isError || foldersQ.isError;

  const qc = useQueryClient();
  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["buttons", activeProfileId] });
    qc.invalidateQueries({ queryKey: ["folders", activeProfileId] });
  }, [activeProfileId, qc]);

  type GridItem =
    | { kind: "button"; data: SDButton; position: number }
    | { kind: "folder"; data: SDFolder; position: number; buttonCount: number };

  const items: GridItem[] = (() => {
    if (currentFolderId !== null) {
      return allButtons
        .filter((b) => b.folderId === currentFolderId)
        .sort((a, b) => a.position - b.position)
        .map((b) => ({ kind: "button" as const, data: b, position: b.position }));
    }
    const rootButtons = allButtons
      .filter((b) => b.folderId == null)
      .map((b) => ({ kind: "button" as const, data: b, position: b.position }));
    const folders = allFolders.map((f) => ({
      kind: "folder" as const,
      data: f,
      position: f.position,
      buttonCount: allButtons.filter((b) => b.folderId === f.id).length,
    }));
    return [...rootButtons, ...folders].sort((a, b) => a.position - b.position);
  })();

  const currentFolder = currentFolderId != null ? allFolders.find((f) => f.id === currentFolderId) : null;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {currentFolder ? (
          <View style={styles.folderHeader}>
            <TouchableOpacity onPress={() => setCurrentFolderId(null)} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
              <Text style={[styles.backText, { color: colors.primary }]}>Назад</Text>
            </TouchableOpacity>
            <Text style={[styles.folderName, { color: colors.foreground }]}>{currentFolder.name}</Text>
            <View style={{ width: 60 }} />
          </View>
        ) : (
          <ProfilePicker
            profiles={profiles}
            selectedId={activeProfileId}
            onSelect={setSelectedProfileId}
          />
        )}
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {isError && (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Нет соединения</Text>
          <TouchableOpacity onPress={refresh} style={[styles.retryBtn, { borderColor: colors.border }]}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <View style={styles.center}>
          <Ionicons name="grid-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Нет кнопок</Text>
        </View>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(it) => `${it.kind}-${it.data.id}`}
          numColumns={COLS}
          contentContainerStyle={[
            styles.grid,
            Platform.OS === "web" && { paddingBottom: 34 },
          ]}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={buttonsQ.isFetching || foldersQ.isFetching}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) =>
            item.kind === "folder" ? (
              <FolderTile
                folder={item.data}
                buttonCount={item.buttonCount}
                onEnter={() => setCurrentFolderId(item.data.id)}
              />
            ) : (
              <ButtonTile btn={item.data} profileId={activeProfileId!} />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2, width: 60 },
  backText: { fontSize: 15, fontWeight: "600" },
  folderName: { fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  profileName: { flex: 1, fontSize: 15, fontWeight: "600" },
  grid: { padding: 12, gap: 8 },
  row: { gap: 8, marginBottom: 8 },
  tile: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    overflow: "hidden",
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  tileSub: {
    fontSize: 9,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerSheet: {
    width: "80%",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    paddingTop: 4,
  },
  pickerTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
    paddingVertical: 12,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerRowText: { fontSize: 15, fontWeight: "500" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 16, fontWeight: "600" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: "600" },
  emptyText: { fontSize: 15, fontWeight: "500" },
});
