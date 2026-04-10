import { Router } from "express";
import { db, foldersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  ListFoldersParams,
  CreateFolderBody,
  UpdateFolderParams,
  UpdateFolderBody,
  DeleteFolderParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/profiles/:id/folders", async (req, res) => {
  const { id } = ListFoldersParams.parse({ id: Number(req.params.id) });
  const folders = await db.select().from(foldersTable)
    .where(eq(foldersTable.profileId, id))
    .orderBy(foldersTable.position);
  res.json(folders);
});

router.post("/folders", async (req, res) => {
  const body = CreateFolderBody.parse(req.body);
  const [folder] = await db.insert(foldersTable).values({
    profileId: body.profileId,
    name: body.name,
    color: body.color ?? "slate",
    icon: body.icon ?? "Folder",
    position: body.position ?? 0,
  }).returning();
  res.status(201).json(folder);
});

router.put("/folders/:id", async (req, res) => {
  const { id } = UpdateFolderParams.parse({ id: Number(req.params.id) });
  const body = UpdateFolderBody.parse(req.body);
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.color !== undefined) updateData.color = body.color;
  if (body.icon !== undefined) updateData.icon = body.icon;
  if (body.position !== undefined) updateData.position = body.position;
  const [folder] = await db.update(foldersTable).set(updateData).where(eq(foldersTable.id, id)).returning();
  if (!folder) return res.status(404).json({ error: "Folder not found" });
  res.json(folder);
});

router.patch("/folders/:id/position", async (req, res) => {
  const id = Number(req.params.id);
  const position = Number(req.body?.position);
  if (isNaN(position)) { res.status(400).json({ error: "position required" }); return; }
  const [folder] = await db.update(foldersTable).set({ position }).where(eq(foldersTable.id, id)).returning();
  if (!folder) { res.status(404).json({ error: "Not found" }); return; }
  res.json(folder);
});

router.delete("/folders/:id", async (req, res) => {
  const { id } = DeleteFolderParams.parse({ id: Number(req.params.id) });
  await db.delete(foldersTable).where(eq(foldersTable.id, id));
  res.status(204).send();
});

export default router;
