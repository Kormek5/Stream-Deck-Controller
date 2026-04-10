import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useProfile } from "@/context/ProfileContext";
import { useColors } from "@/hooks/useColors";

type Profile = { id: number; name: string; icon: string; isDefault: boolean; createdAt: string };

function getApiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  if (Platform.OS === "web") return "/api";
  return "http://localhost:3001/api";
}

export default function ProfilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedProfileId, setSelectedProfileId } = useProfile();

  const { data, isLoading, isError, refetch } = useQuery<Profile[]>({
    queryKey: ["profiles"],
    queryFn: () => fetch(`${getApiBase()}/profiles`).then((r) => r.json()),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const renderItem = ({ item }: { item: Profile }) => {
    const isActive = item.id === selectedProfileId;
    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedProfileId(item.id);
          Haptics.selectionAsync();
        }}
        style={[
          styles.row,
          {
            backgroundColor: isActive ? colors.card : "transparent",
            borderColor: isActive ? colors.primary : colors.border,
          },
        ]}
        activeOpacity={0.7}
      >
        <View
          style={[styles.iconCircle, { backgroundColor: isActive ? colors.primary : colors.muted }]}
        >
          <Ionicons
            name="person-outline"
            size={18}
            color={isActive ? "#fff" : colors.mutedForeground}
          />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
          {item.isDefault && (
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>По умолчанию</Text>
          )}
        </View>
        {isActive ? (
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={colors.border} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.title, { color: colors.foreground }]}>Профили</Text>
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {isError && (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Нет соединения</Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={[styles.retryBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>Повторить</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !isError && (
        <FlatList
          data={data ?? []}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={[
            styles.list,
            Platform.OS === "web" && { paddingBottom: 34 },
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Профилей нет
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </View>
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
  list: { padding: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  sub: { fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 60 },
  emptyText: { fontSize: 15 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: "600" },
});
