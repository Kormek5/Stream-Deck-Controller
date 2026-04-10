import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  browser: "globe-outline", airdrop: "send-outline",
};

const ACTION_TYPES = [
  { value: "url", label: "URL" },
  { value: "hotkey", label: "Горячая клавиша" },
  { value: "script", label: "Скрипт" },
  { value: "app", label: "Приложение" },
  { value: "media", label: "Медиа" },
  { value: "system", label: "Система" },
  { value: "browser", label: "Браузер" },
  { value: "clipboard", label: "Буфер обмена" },
  { value: "spotify", label: "Spotify" },
  { value: "yandexmusic", label: "Яндекс Музыка" },
  { value: "discord", label: "Discord" },
  { value: "zoom", label: "Zoom" },
  { value: "teams", label: "MS Teams" },
  { value: "slack", label: "Slack" },
  { value: "telegram", label: "Telegram" },
  { value: "obs", label: "OBS" },
  { value: "github", label: "GitHub" },
  { value: "youtube", label: "YouTube" },
  { value: "twitch", label: "Twitch" },
  { value: "vscode", label: "VS Code" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "steam", label: "Steam" },
  { value: "vpn", label: "VPN" },
  { value: "wol", label: "Wake on LAN" },
  { value: "wallpaperengine", label: "Wallpaper Engine" },
  { value: "googlemeet", label: "Google Meet" },
  { value: "gmail", label: "Gmail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "notion", label: "Notion" },
  { value: "figma", label: "Figma" },
  { value: "x", label: "X (Twitter)" },
];

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

// ─── Edit Button Modal ──────────────────────────────────────────────────────

function EditButtonModal({
  btn,
  visible,
  onClose,
  profileId,
}: {
  btn: SDButton;
  visible: boolean;
  onClose: () => void;
  profileId: number;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [label, setLabel] = useState(btn.label);
  const [color, setColor] = useState(btn.color);
  const [actionType, setActionType] = useState(btn.actionType);
  const [actionValue, setActionValue] = useState(btn.actionValue);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const reset = () => {
    setLabel(btn.label);
    setColor(btn.color);
    setActionType(btn.actionType);
    setActionValue(btn.actionValue);
    setShowTypePicker(false);
  };

  const saveMut = useMutation({
    mutationFn: () =>
      fetch(`${getApiBase()}/buttons/${btn.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: btn.profileId,
          folderId: btn.folderId,
          label,
          icon: btn.icon,
          color,
          actionType,
          actionValue,
          position: btn.position,
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["buttons", profileId] });
      onClose();
    },
  });

  const deleteMut = useMutation({
    mutationFn: () =>
      fetch(`${getApiBase()}/buttons/${btn.id}`, { method: "DELETE" }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ["buttons", profileId] });
      onClose();
    },
  });

  const handleClose = () => { reset(); onClose(); };
  const selectedType = ACTION_TYPES.find((t) => t.value === actionType);
  const bgColor = getButtonBg(color);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View
          style={[
            editStyles.modalHeader,
            {
              paddingTop: insets.top > 0 ? insets.top + 8 : (Platform.OS === "web" ? 67 : 16),
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity onPress={handleClose} style={editStyles.headerBtn}>
            <Text style={[editStyles.cancelText, { color: colors.mutedForeground }]}>Отмена</Text>
          </TouchableOpacity>
          <Text style={[editStyles.modalTitle, { color: colors.foreground }]}>Редактировать</Text>
          <TouchableOpacity
            onPress={() => saveMut.mutate()}
            style={editStyles.headerBtn}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[editStyles.saveText, { color: colors.primary }]}>Сохранить</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[editStyles.scrollBody, Platform.OS === "web" && { paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Preview tile */}
          <View style={editStyles.previewRow}>
            <View style={[editStyles.previewTile, { backgroundColor: bgColor }]}>
              <Ionicons name={getActionIcon(actionType) as any} size={28} color="rgba(255,255,255,0.9)" style={{ marginBottom: 4 }} />
              <Text style={editStyles.previewLabel} numberOfLines={2}>
                {label.toUpperCase() || "КНОПКА"}
              </Text>
            </View>
          </View>

          {/* Label */}
          <View style={[editStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[editStyles.sectionLabel, { color: colors.mutedForeground }]}>НАЗВАНИЕ</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              style={[editStyles.input, { color: colors.foreground, borderColor: colors.border }]}
              placeholderTextColor={colors.mutedForeground}
              placeholder="Название кнопки"
              returnKeyType="done"
            />
          </View>

          {/* Color picker */}
          <View style={[editStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[editStyles.sectionLabel, { color: colors.mutedForeground }]}>ЦВЕТ</Text>
            <View style={editStyles.colorGrid}>
              {Object.entries(BUTTON_COLORS).map(([key, hex]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => { setColor(key); Haptics.selectionAsync(); }}
                  style={[
                    editStyles.colorSwatch,
                    { backgroundColor: hex },
                    color === key && editStyles.colorSwatchActive,
                  ]}
                >
                  {color === key && (
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action type */}
          <View style={[editStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[editStyles.sectionLabel, { color: colors.mutedForeground }]}>ТИП ДЕЙСТВИЯ</Text>
            <TouchableOpacity
              onPress={() => setShowTypePicker(true)}
              style={[editStyles.typePicker, { borderColor: colors.border }]}
            >
              <Ionicons
                name={getActionIcon(actionType) as any}
                size={18}
                color={colors.primary}
              />
              <Text style={[editStyles.typePickerText, { color: colors.foreground }]}>
                {selectedType?.label ?? actionType}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Action value */}
          <View style={[editStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[editStyles.sectionLabel, { color: colors.mutedForeground }]}>
              {actionType === "hotkey" ? "КОМБИНАЦИЯ КЛАВИШ" :
               actionType === "script" ? "СКРИПТ" :
               actionType === "url" || actionType === "browser" ? "URL" :
               "ЗНАЧЕНИЕ"}
            </Text>
            <TextInput
              value={actionValue}
              onChangeText={setActionValue}
              style={[
                editStyles.input,
                { color: colors.foreground, borderColor: colors.border },
                actionType === "script" && { height: 100, textAlignVertical: "top" },
              ]}
              placeholderTextColor={colors.mutedForeground}
              placeholder={
                actionType === "url" ? "https://..." :
                actionType === "hotkey" ? "ctrl+shift+t" :
                actionType === "script" ? "Write-Host 'Hello'" :
                "Значение действия"
              }
              multiline={actionType === "script"}
              returnKeyType={actionType === "script" ? "default" : "done"}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Delete */}
          <TouchableOpacity
            onPress={() => deleteMut.mutate()}
            style={[editStyles.deleteBtn, { borderColor: "#ef4444" }]}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={editStyles.deleteText}>Удалить кнопку</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Action Type Picker Sheet */}
      <Modal
        visible={showTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTypePicker(false)}
      >
        <View style={[editStyles.typeSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[editStyles.typeSheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[editStyles.typeSheetTitle, { color: colors.foreground }]}>Тип действия</Text>
          <FlatList
            data={ACTION_TYPES}
            keyExtractor={(t) => t.value}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setActionType(item.value);
                  setShowTypePicker(false);
                  Haptics.selectionAsync();
                }}
                style={[editStyles.typeRow, { borderBottomColor: colors.border }]}
              >
                <Ionicons
                  name={getActionIcon(item.value) as any}
                  size={20}
                  color={item.value === actionType ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    editStyles.typeRowText,
                    { color: item.value === actionType ? colors.primary : colors.foreground },
                  ]}
                >
                  {item.label}
                </Text>
                {item.value === actionType && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </Modal>
  );
}

// ─── Animated Tile ──────────────────────────────────────────────────────────

function AnimatedTile({
  children,
  onPress,
  bg,
}: {
  children: React.ReactNode;
  onPress: () => void;
  bg: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(withSpring(0.88, { damping: 12 }), withSpring(1, { damping: 12 }));
    onPress();
  };

  return (
    <Animated.View style={[animStyle, { width: TILE_SIZE, height: TILE_SIZE }]}>
      <Pressable onPress={handlePress} style={[styles.tile, { backgroundColor: bg }]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ─── Button Tile ────────────────────────────────────────────────────────────

function ButtonTile({
  btn,
  profileId,
  editMode,
}: {
  btn: SDButton;
  profileId: number;
  editMode: boolean;
}) {
  const qc = useQueryClient();
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);
  const [editing, setEditing] = useState(false);

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
    <>
      <AnimatedTile
        bg={bg}
        onPress={() => {
          if (editMode) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setEditing(true);
          } else {
            exec.mutate();
          }
        }}
      >
        {flash && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayBg, borderRadius: 12 }]} />
        )}
        {editMode && (
          <View style={styles.editBadge}>
            <Ionicons name="pencil" size={10} color="#fff" />
          </View>
        )}
        <Ionicons
          name={getActionIcon(btn.actionType) as any}
          size={26}
          color="rgba(255,255,255,0.9)"
          style={{ marginBottom: 4 }}
        />
        <Text style={styles.tileLabel} numberOfLines={2}>
          {btn.label.toUpperCase()}
        </Text>
        {exec.isPending && (
          <ActivityIndicator size="small" color="#fff" style={StyleSheet.absoluteFill} />
        )}
      </AnimatedTile>

      {editing && (
        <EditButtonModal
          btn={btn}
          visible={editing}
          onClose={() => setEditing(false)}
          profileId={profileId}
        />
      )}
    </>
  );
}

// ─── Folder Tile ────────────────────────────────────────────────────────────

function FolderTile({
  folder,
  buttonCount,
  onEnter,
  editMode,
}: {
  folder: SDFolder;
  buttonCount: number;
  onEnter: () => void;
  editMode: boolean;
}) {
  const bg = getButtonBg(folder.color);
  return (
    <AnimatedTile bg={bg} onPress={onEnter}>
      {editMode && (
        <View style={styles.editBadge}>
          <Ionicons name="folder" size={10} color="#fff" />
        </View>
      )}
      <Ionicons name="folder-open-outline" size={26} color="rgba(255,255,255,0.9)" style={{ marginBottom: 4 }} />
      <Text style={styles.tileLabel} numberOfLines={2}>
        {folder.name.toUpperCase()}
      </Text>
      <Text style={styles.tileSub}>{buttonCount} кн.</Text>
    </AnimatedTile>
  );
}

// ─── Profile Picker ─────────────────────────────────────────────────────────

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

// ─── Deck Screen ─────────────────────────────────────────────────────────────

export default function DeckScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedProfileId, setSelectedProfileId, currentFolderId, setCurrentFolderId } = useProfile();
  const [editMode, setEditMode] = useState(false);

  const profilesQ = useQuery<Profile[]>({
    queryKey: ["profiles"],
    queryFn: () => fetch(`${getApiBase()}/profiles`).then((r) => r.json()),
    onSuccess: (data: Profile[]) => {
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
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: editMode ? colors.primary : colors.border,
            borderBottomWidth: editMode ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}
      >
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
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <ProfilePicker
                profiles={profiles}
                selectedId={activeProfileId}
                onSelect={(id) => { setSelectedProfileId(id); setEditMode(false); }}
              />
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditMode((v) => !v);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.editModeBtn,
                {
                  backgroundColor: editMode ? colors.primary : colors.card,
                  borderColor: editMode ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons
                name={editMode ? "pencil" : "pencil-outline"}
                size={18}
                color={editMode ? "#fff" : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        )}
        {editMode && (
          <Text style={[styles.editHint, { color: colors.primary }]}>
            Нажмите на кнопку чтобы редактировать
          </Text>
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
          contentContainerStyle={[styles.grid, Platform.OS === "web" && { paddingBottom: 34 }]}
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
                editMode={editMode}
              />
            ) : (
              <ButtonTile btn={item.data} profileId={activeProfileId!} editMode={editMode} />
            )
          }
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  editModeBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  editHint: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    letterSpacing: 0.3,
  },
  grid: { padding: 12, gap: 8 },
  row: { gap: 8, marginBottom: 8 },
  tile: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  tileSub: { fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  editBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 6,
    padding: 3,
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

const editStyles = StyleSheet.create({
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { minWidth: 70, paddingVertical: 4 },
  cancelText: { fontSize: 15 },
  saveText: { fontSize: 15, fontWeight: "700", textAlign: "right" },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  scrollBody: { padding: 16, gap: 16 },
  previewRow: { alignItems: "center", paddingVertical: 8 },
  previewTile: {
    width: 100,
    height: 100,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 44,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
    transform: [{ scale: 1.15 }],
  },
  typePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  typePickerText: { flex: 1, fontSize: 15 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteText: { color: "#ef4444", fontSize: 15, fontWeight: "600" },
  typeSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "70%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingTop: 12,
  },
  typeSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  typeSheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  typeRowText: { flex: 1, fontSize: 15 },
});
