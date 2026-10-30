export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const normalized = title.trim().toLowerCase();
  const fallbackSlug = generateSlug(title) || `project-${Date.now().toString().slice(-4)}`;

  try {
    const adminMod = await import('./_lib/admin.js').catch(() => null);
    if (!adminMod || !adminMod.hasServiceAccountCredentials()) {
      return res.status(200).json({
        available: true,
        titleTaken: false,
        slug: fallbackSlug,
        fallback: true,
      });
    }

    try {
      await adminMod.verifyAuth(req);
    } catch (err: any) {
      return res.status(401).json({ error: err?.message || 'Unauthorized' });
    }

    const db = adminMod.getAdminDb();

    // Check if titleLower is taken across all projects (Admin SDK bypasses client read rules)
    const titleSnap = await db
      .collection('projects')
      .where('titleLower', '==', normalized)
      .limit(1)
      .get();

    if (!titleSnap.empty) {
      return res.status(200).json({
        available: false,
        titleTaken: true,
        message: 'A project with this name already exists. Please choose a different title.',
      });
    }

    // Generate unique slug
    let baseSlug = generateSlug(title);
    if (!baseSlug) baseSlug = 'project';

    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const slugSnap = await db
        .collection('projects')
        .where('slug', '==', slug)
        .limit(1)
        .get();

      if (slugSnap.empty) break;
      counter += 1;
      slug = `${baseSlug}-${counter}`;
    }

    return res.status(200).json({
      available: true,
      titleTaken: false,
      slug,
    });
  } catch (err: any) {
    console.warn('Project availability check fallback:', err?.message);
    return res.status(200).json({
      available: true,
      titleTaken: false,
      slug: fallbackSlug,
      fallback: true,
    });
  }
}
