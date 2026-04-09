import { pgTable, text, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("Layout"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({ id: true, createdAt: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;

export const foldersTable = pgTable("folders", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("slate"),
  icon: text("icon").notNull().default("Folder"),
  position: integer("position").notNull().default(0),
});

export const insertFolderSchema = createInsertSchema(foldersTable).omit({ id: true });
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof foldersTable.$inferSelect;

export const buttonsTable = pgTable("buttons", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => foldersTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  icon: text("icon").notNull().default("Zap"),
  color: text("color").notNull().default("teal"),
  actionType: text("action_type").notNull().default("url"),
  actionValue: text("action_value").notNull().default(""),
  position: integer("position").notNull().default(0),
  executeCount: integer("execute_count").notNull().default(0),
  lastExecutedAt: timestamp("last_executed_at"),
});

export const insertButtonSchema = createInsertSchema(buttonsTable).omit({ id: true, executeCount: true, lastExecutedAt: true });
export type InsertButton = z.infer<typeof insertButtonSchema>;
export type Button = typeof buttonsTable.$inferSelect;

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  buttonId: integer("button_id").notNull(),
  buttonLabel: text("button_label").notNull(),
  actionType: text("action_type").notNull(),
  success: boolean("success").notNull().default(true),
  message: text("message").notNull().default(""),
  executedAt: timestamp("executed_at").notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activityTable).omit({ id: true, executedAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityTable.$inferSelect;
