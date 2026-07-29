import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// Professional profile (LinkedIn-style). Core user fields live on User;
// extended fields + collections live in User.profileMeta (JSON).
export const profileRouter = Router();

profileRouter.use(authenticate);

type ProfileMeta = {
  username?: string;
  headline?: string;
  bio?: string;
  city?: string;
  country?: string;
  experienceYears?: number;
  photoUrl?: string;
  visibility?: 'public' | 'private';
  skills?: Array<{ id: string; name: string; level?: string | null }>;
  certificates?: Array<{ id: string; title: string; issuer?: string | null; year?: number | null; fileUrl?: string | null }>;
  achievements?: Array<{ id: string; title: string; description?: string | null; date?: string | null }>;
  portfolio?: Array<{ id: string; title: string; description?: string | null; imageUrl?: string | null; link?: string | null }>;
  cases?: Array<{ id: string; title: string; description?: string | null; beforeImage?: string | null; afterImage?: string | null; tags?: string[] }>;
  reviews?: Array<{ id: string; authorName?: string; rating?: number; comment?: string | null; createdAt?: string }>;
  activities?: Array<{ id: string; title: string; createdAt: string }>;
};

function asMeta(raw: unknown): ProfileMeta {
  return raw && typeof raw === 'object' ? (raw as ProfileMeta) : {};
}

function shapeUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  spec: string | null;
  avatar: string | null;
  role: string;
  profileMeta: unknown;
}) {
  const meta = asMeta(user.profileMeta);
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    spec: user.spec,
    avatar: user.avatar,
    role: user.role,
    photoUrl: meta.photoUrl || user.avatar || '',
    username: meta.username || '',
    headline: meta.headline || '',
    bio: meta.bio || '',
    city: meta.city || '',
    country: meta.country || '',
    experienceYears: meta.experienceYears || 0,
    visibility: meta.visibility || 'public',
    name: [user.firstName, user.lastName].filter(Boolean).join(' '),
  };
}

async function loadUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      phone: true, spec: true, avatar: true, role: true, profileMeta: true,
    },
  });
}

profileRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const user = await loadUser(req.user!.id);
    if (!user) return res.status(404).json({ ok: false, error: 'Пользователь не найден' } satisfies ApiResponse);
    const meta = asMeta(user.profileMeta);
    return res.json({
      ok: true,
      data: {
        user: shapeUser(user),
        skills: meta.skills || [],
        certificates: meta.certificates || [],
        achievements: meta.achievements || [],
        portfolio: meta.portfolio || [],
        cases: meta.cases || [],
        reviews: meta.reviews || [],
        activities: meta.activities || [],
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить профиль' } satisfies ApiResponse);
  }
});

profileRouter.put('/', async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const user = await loadUser(req.user!.id);
    if (!user) return res.status(404).json({ ok: false, error: 'Пользователь не найден' } satisfies ApiResponse);

    const meta = asMeta(user.profileMeta);
    const nextMeta: ProfileMeta = {
      ...meta,
      username: body.username !== undefined ? String(body.username).replace(/\s/g, '') : meta.username,
      headline: body.headline !== undefined ? String(body.headline) : meta.headline,
      bio: body.bio !== undefined ? String(body.bio) : meta.bio,
      city: body.city !== undefined ? String(body.city) : meta.city,
      country: body.country !== undefined ? String(body.country) : meta.country,
      experienceYears: body.experienceYears !== undefined ? Number(body.experienceYears) || 0 : meta.experienceYears,
      photoUrl: body.photoUrl !== undefined ? String(body.photoUrl) : meta.photoUrl,
      visibility: body.visibility === 'private' ? 'private' : (body.visibility === 'public' ? 'public' : meta.visibility),
    };

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: body.firstName !== undefined ? String(body.firstName) : undefined,
        lastName: body.lastName !== undefined ? String(body.lastName) : undefined,
        phone: body.phone !== undefined ? String(body.phone) : undefined,
        spec: body.spec !== undefined ? String(body.spec) : undefined,
        email: body.email !== undefined ? String(body.email) : undefined,
        avatar: body.photoUrl !== undefined ? String(body.photoUrl) || null : undefined,
        profileMeta: nextMeta as object,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, spec: true, avatar: true, role: true, profileMeta: true,
      },
    });

    return res.json({ ok: true, data: shapeUser(updated) } satisfies ApiResponse);
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить профиль' } satisfies ApiResponse);
  }
});

async function mutateCollection(
  req: AuthRequest,
  res: any,
  key: keyof ProfileMeta,
  item: Record<string, unknown>,
) {
  const user = await loadUser(req.user!.id);
  if (!user) return res.status(404).json({ ok: false, error: 'Пользователь не найден' } satisfies ApiResponse);
  const meta = asMeta(user.profileMeta);
  const list = Array.isArray(meta[key]) ? [...(meta[key] as any[])] : [];
  const row = { id: uid(), ...item };
  list.push(row);
  const nextMeta = { ...meta, [key]: list };
  await prisma.user.update({ where: { id: user.id }, data: { profileMeta: nextMeta as object } });
  return res.status(201).json({ ok: true, data: row } satisfies ApiResponse);
}

async function deleteFromCollection(req: AuthRequest, res: any, key: keyof ProfileMeta) {
  const user = await loadUser(req.user!.id);
  if (!user) return res.status(404).json({ ok: false, error: 'Пользователь не найден' } satisfies ApiResponse);
  const meta = asMeta(user.profileMeta);
  const id = req.params.id as string;
  const list = (Array.isArray(meta[key]) ? (meta[key] as any[]) : []).filter((x) => x.id !== id);
  await prisma.user.update({ where: { id: user.id }, data: { profileMeta: { ...meta, [key]: list } as object } });
  return res.json({ ok: true, data: { id } } satisfies ApiResponse);
}

profileRouter.post('/skills', async (req: AuthRequest, res) => {
  try {
    return await mutateCollection(req, res, 'skills', { name: req.body?.name, level: req.body?.level || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});
profileRouter.delete('/skills/:id', async (req: AuthRequest, res) => {
  try { return await deleteFromCollection(req, res, 'skills'); }
  catch (e) { return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse); }
});

profileRouter.post('/certificates', async (req: AuthRequest, res) => {
  try {
    return await mutateCollection(req, res, 'certificates', {
      title: req.body?.title, issuer: req.body?.issuer || null,
      year: req.body?.year ? Number(req.body.year) : null, fileUrl: req.body?.fileUrl || null,
    });
  } catch (e) { return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse); }
});
profileRouter.delete('/certificates/:id', async (req: AuthRequest, res) => {
  try { return await deleteFromCollection(req, res, 'certificates'); }
  catch (e) { return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse); }
});

profileRouter.post('/achievements', async (req: AuthRequest, res) => {
  try {
    return await mutateCollection(req, res, 'achievements', {
      title: req.body?.title, description: req.body?.description || null, date: req.body?.date || null,
    });
  } catch (e) { return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse); }
});
profileRouter.delete('/achievements/:id', async (req: AuthRequest, res) => {
  try { return await deleteFromCollection(req, res, 'achievements'); }
  catch (e) { return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse); }
});

profileRouter.post('/portfolio', async (req: AuthRequest, res) => {
  try {
    return await mutateCollection(req, res, 'portfolio', {
      title: req.body?.title, description: req.body?.description || null,
      imageUrl: req.body?.imageUrl || null, link: req.body?.link || null,
    });
  } catch (e) { return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse); }
});
profileRouter.delete('/portfolio/:id', async (req: AuthRequest, res) => {
  try { return await deleteFromCollection(req, res, 'portfolio'); }
  catch (e) { return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse); }
});

profileRouter.post('/cases', async (req: AuthRequest, res) => {
  try {
    return await mutateCollection(req, res, 'cases', {
      title: req.body?.title, description: req.body?.description || null,
      beforeImage: req.body?.beforeImage || null, afterImage: req.body?.afterImage || null,
      tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
    });
  } catch (e) { return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse); }
});
profileRouter.delete('/cases/:id', async (req: AuthRequest, res) => {
  try { return await deleteFromCollection(req, res, 'cases'); }
  catch (e) { return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse); }
});

export default profileRouter;
