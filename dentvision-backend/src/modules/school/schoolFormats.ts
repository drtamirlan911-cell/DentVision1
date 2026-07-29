/**
 * Shared helpers for Academy OS sellable formats (course / webinar / textbook / office).
 */
export const SCHOOL_FORMATS = ['course', 'webinar', 'textbook', 'office'] as const;
export type SchoolFormat = (typeof SCHOOL_FORMATS)[number];

export function normalizeSchoolFormat(raw: unknown): SchoolFormat {
  const v = String(raw || 'course').toLowerCase().trim();
  if (v === 'live') return 'webinar';
  if (v === 'book' || v === 'pdf' || v === 'library') return 'textbook';
  if ((SCHOOL_FORMATS as readonly string[]).includes(v)) return v as SchoolFormat;
  return 'course';
}

export function formatLabel(format: SchoolFormat): string {
  switch (format) {
    case 'webinar':
      return 'Вебинар';
    case 'textbook':
      return 'Учебник';
    case 'office':
      return 'Офис-курс';
    default:
      return 'Курс';
  }
}

/** Map a Course row to marketplace webinar/office card shape. */
export function mapCourseToEventCard(course: {
  id: string;
  title: string;
  description?: string | null;
  price?: number | null;
  duration?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  format?: string | null;
  startsAt?: Date | null;
  seats?: number | null;
  fileUrl?: string | null;
  meta?: unknown;
  lecturerId?: string | null;
  author?: string | null;
  _count?: { enrollments?: number };
  lecturer?: { level?: string | null } | null;
  academy?: { name?: string | null } | null;
}) {
  const format = normalizeSchoolFormat(course.format);
  const meta = (course.meta && typeof course.meta === 'object' ? course.meta : {}) as Record<string, unknown>;
  const enrolled = course._count?.enrollments ?? 0;
  const seats = course.seats ?? (format === 'textbook' ? null : Number(meta.seats) || 50);
  const durationNum = course.duration
    ? Number(String(course.duration).replace(/[^\d.]/g, '')) || null
    : null;

  return {
    id: course.id,
    title: course.title,
    description: course.description || '',
    price: Number(course.price || 0),
    currency: 'KZT',
    format,
    startsAt: course.startsAt ? course.startsAt.toISOString() : (meta.startsAt as string) || null,
    durationMin: durationNum,
    duration: course.duration,
    seats: seats == null ? undefined : seats,
    enrolled,
    seatsLeft: seats == null ? undefined : Math.max(0, seats - enrolled),
    category: course.category || 'Academy OS',
    imageUrl: course.imageUrl,
    fileUrl: course.fileUrl || (meta.fileUrl as string) || null,
    pages: meta.pages ?? null,
    includes: Array.isArray(meta.includes) ? meta.includes : undefined,
    venue: (meta.venue as string) || null,
    certificate: meta.certificate !== false,
    lecturerId: course.lecturerId,
    instructor: course.author || course.academy?.name || 'Лектор',
    // Aliases for marketplace CommerceCard (soft catalog uses lecturer/academy).
    lecturer: course.author || course.academy?.name || 'Лектор',
    academy: course.academy?.name || null,
    lecturerLevel: course.lecturer?.level || null,
    academyName: course.academy?.name || null,
    source: 'lecturer' as const,
  };
}
