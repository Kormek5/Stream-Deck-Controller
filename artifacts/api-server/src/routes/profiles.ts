import { Router } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateProfileBody,
  UpdateProfileBody,
  GetProfileParams,
  UpdateProfileParams,
  DeleteProfileParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const profiles = await db.select().from(profilesTable).orderBy(profilesTable.id);
  res.json(profiles);
});

router.post("/", async (req, res) => {
  const body = CreateProfileBody.parse(req.body);
  const [profile] = await db.insert(profilesTable).values({
    name: body.name,
    icon: body.icon,
    isDefault: body.isDefault ?? false,
  }).returning();
  res.status(201).json(profile);
});

router.get("/:id", async (req, res) => {
  const { id } = GetProfileParams.parse({ id: Number(req.params.id) });
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, id));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateProfileParams.parse({ id: Number(req.params.id) });
  const body = UpdateProfileBody.parse(req.body);
  const [profile] = await db.update(profilesTable)
    .set({ name: body.name, icon: body.icon, isDefault: body.isDefault ?? false })
    .where(eq(profilesTable.id, id))
    .returning();
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteProfileParams.parse({ id: Number(req.params.id) });
  await db.delete(profilesTable).where(eq(profilesTable.id, id));
  res.status(204).send();
});

export default router;
