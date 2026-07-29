import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import { AuthRequest } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import { resolveSupplierCity } from '../../lib/kzCities.js';

const shopRouter = Router();

function buildProductResponse(p: any) {
  const supplierCity = p.supplier ? resolveSupplierCity(p.supplier) : null;
  const specs = (p.specs && typeof p.specs === 'object' ? p.specs : {}) as Record<string, unknown>;
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const images = Array.isArray(p.images) ? p.images : (p.imageUrl ? [p.imageUrl] : []);
  return {
    id: p.id,
    name: p.name,
    brand: p.brand || '',
    category: p.category,
    categoryId: p.categoryId,
    category_name: p.shopCategory?.name || p.category || 'Прочее',
    category_slug: p.shopCategory?.slug || null,
    price: Number(p.price),
    oldPrice: p.oldPrice ? Number(p.oldPrice) : null,
    stock: p.stock,
    minStock: p.minStock,
    description: p.description,
    imageUrl: p.imageUrl || null,
    images,
    rating: p.rating ?? null,
    reviewCount: p.reviewCount || 0,
    supplierId: p.supplierId,
    supplier_name: p.supplier?.name || null,
    supplier_status: p.supplier?.status || null,
    supplier_city: supplierCity,
    ownBrand: !!(p as any).ownBrand,
    sku: p.sku || null,
    unit: p.unit || 'шт',
    currency: p.currency || 'KZT',
    tags,
    specs,
    seoTitle: p.seoTitle || null,
    seoDescription: p.seoDescription || null,
    videoUrl: p.videoUrl || null,
    model3dUrl: p.model3dUrl || null,
    weight: p.weight || null,
    manufacturer: p.manufacturer || null,
    country: p.country || null,
    expiryDate: p.expiryDate || null,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

shopRouter.get('/products', async (req, res) => {
  try {
    const {
      category, categorySlug, search, sort, city, supplierId,
      minPrice, maxPrice, brand, tags, inStock, rating,
    } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const { skip, take } = paginate(page, limit);

    const where: Record<string, unknown> = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { brand: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const cityFilter = typeof city === 'string' ? city.trim() : '';
    if (cityFilter && cityFilter !== 'all') {
      where.supplier = {
        OR: [
          { city: { equals: cityFilter } },
          { legalAddress: { contains: cityFilter } },
        ],
      };
    }

    if (supplierId && typeof supplierId === 'string') {
      where.supplierId = supplierId;
    }
    if (minPrice && typeof minPrice === 'string') {
      where.price = { ...(where.price as object || {}), gte: parseInt(minPrice) };
    }
    if (maxPrice && typeof maxPrice === 'string') {
      where.price = { ...(where.price as object || {}), lte: parseInt(maxPrice) };
    }
    if (brand && typeof brand === 'string') {
      where.brand = { equals: brand };
    }
    if (inStock === 'true') {
      where.stock = { gt: 0 };
    }
    if (rating && typeof rating === 'string') {
      where.rating = { gte: parseFloat(rating) };
    }

    let orderBy: Record<string, string>;
    switch (sort) {
      case 'price_asc': orderBy = { price: 'asc' }; break;
      case 'price_desc': orderBy = { price: 'desc' }; break;
      case 'rating': orderBy = { rating: 'desc' }; break;
      case 'popular': orderBy = { rating: 'desc' }; break;
      case 'newest': default: orderBy = { createdAt: 'desc' }; break;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          supplier: { select: { id: true, name: true, status: true, city: true, legalAddress: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const brandAgg = products.length > 20
      ? []
      : await prisma.product.findMany({
          where: { ...where, brand: { not: null } },
          select: { brand: true },
          distinct: ['brand'],
          take: 50,
        });

    res.json({
      ok: true,
      data: products.map(buildProductResponse),
      brands: brandAgg.map((b: { brand: string | null }) => b.brand).filter(Boolean),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Failed to fetch products:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch products' });
  }
});

shopRouter.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, status: true, city: true, legalAddress: true, logo: true, description: true, rating: true } },
      },
    });

    if (!product) {
      res.status(404).json({ ok: false, error: 'Product not found' });
      return;
    }

    const related = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        OR: [
          ...(product.categoryId ? [{ categoryId: product.categoryId }] : []),
          ...(product.supplierId ? [{ supplierId: product.supplierId }] : []),
        ],
      },
      take: 8,
      orderBy: { rating: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, city: true } },
      },
    });

    res.json({
      ok: true,
      data: {
        ...buildProductResponse(product),
        specTemplate,
        relatedProducts: related.map(buildProductResponse),
        supplier: product.supplier ? {
          id: product.supplier.id,
          name: product.supplier.name,
          status: product.supplier.status,
          city: resolveSupplierCity(product.supplier),
          logo: (product.supplier as any).logo || null,
          description: (product.supplier as any).description || null,
          rating: (product.supplier as any).rating || null,
        } : null,
      },
    });
  } catch (error) {
    console.error('Failed to fetch product:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch product' });
  }
});

shopRouter.get('/categories', async (_req, res) => {
  try {
    const categories = await prisma.shopCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: true } },
        specTemplates: { orderBy: { sortOrder: 'asc' } },
      },
    });

    const byId = new Map(categories.map((c: any) => [c.id, { ...c, children: [] }]));
    const roots: any[] = [];
    for (const cat of byId.values()) {
      if (cat.parentId && byId.has(cat.parentId)) {
        byId.get(cat.parentId)!.children.push(cat);
      } else {
        roots.push(cat);
      }
    }

    res.json({ ok: true, data: roots });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch categories' });
  }
});

shopRouter.get('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.shopCategory.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        specTemplates: { orderBy: { sortOrder: 'asc' } },
        parent: true,
        children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      res.status(404).json({ ok: false, error: 'Category not found' });
      return;
    }

    const breadcrumb: any[] = [];
    let current: any = category;
    while (current?.parent) {
      breadcrumb.unshift({ id: current.parent.id, name: current.parent.name, slug: current.parent.slug });
      current = current.parent;
    }

    res.json({ ok: true, data: { ...category, breadcrumb } });
  } catch (error) {
    console.error('Failed to fetch category:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch category' });
  }
});

shopRouter.post('/categories', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { parentId, name, slug, icon, description, imageUrl, sortOrder } = req.body;
    if (!name || !slug) {
      res.status(400).json({ ok: false, error: 'name and slug are required' });
      return;
    }
    const category = await prisma.shopCategory.create({
      data: {
        id: uid(),
        parentId: parentId || null,
        name,
        slug,
        icon: icon || null,
        description: description || null,
        imageUrl: imageUrl || null,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.status(201).json({ ok: true, data: category });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ ok: false, error: 'Category with this slug already exists' });
      return;
    }
    console.error('Failed to create category:', error);
    res.status(500).json({ ok: false, error: 'Failed to create category' });
  }
});

shopRouter.patch('/categories/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { parentId, name, slug, icon, description, imageUrl, sortOrder, isActive } = req.body;
    const category = await prisma.shopCategory.update({
      where: { id },
      data: {
        ...(parentId !== undefined ? { parentId: parentId || null } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    res.json({ ok: true, data: category });
  } catch (error) {
    console.error('Failed to update category:', error);
    res.status(500).json({ ok: false, error: 'Failed to update category' });
  }
});

shopRouter.delete('/categories/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.shopCategory.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete category:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete category' });
  }
});

shopRouter.get('/spec-templates', async (req, res) => {
  try {
    const { categoryId } = req.query;
    const where: Record<string, unknown> = {};
    if (categoryId && typeof categoryId === 'string') {
      where.OR = [
        { categoryId },
        { categoryId: null },
      ];
    }
    const templates = await prisma.specTemplate.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ ok: true, data: templates });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch spec templates' });
  }
});

shopRouter.post('/spec-templates', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { categoryId, name, type, unit, options, required, sortOrder } = req.body;
    if (!name) {
      res.status(400).json({ ok: false, error: 'name is required' });
      return;
    }
    const template = await prisma.specTemplate.create({
      data: {
        id: uid(),
        categoryId: categoryId || null,
        name,
        type: type || 'TEXT',
        unit: unit || null,
        options: options || null,
        required: required ?? false,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.status(201).json({ ok: true, data: template });
  } catch (error) {
    console.error('Failed to create spec template:', error);
    res.status(500).json({ ok: false, error: 'Failed to create spec template' });
  }
});

shopRouter.patch('/spec-templates/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const template = await prisma.specTemplate.update({ where: { id }, data });
    res.json({ ok: true, data: template });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to update spec template' });
  }
});

shopRouter.delete('/spec-templates/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.specTemplate.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to delete spec template' });
  }
});

shopRouter.get('/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const { skip, take } = paginate(page, limit);

    const [reviews, total] = await Promise.all([
      prisma.shopReview.findMany({
        where: { productId: id, isApproved: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      }),
      prisma.shopReview.count({ where: { productId: id, isApproved: true } }),
    ]);

    res.json({
      ok: true,
      data: reviews.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        pros: r.pros,
        cons: r.cons,
        comment: r.comment,
        images: r.images,
        helpfulCount: r.helpfulCount,
        user: r.user ? {
          id: r.user.id,
          name: `${r.user.firstName} ${r.user.lastName}`,
          avatar: r.user.avatar,
        } : null,
        createdAt: r.createdAt,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch reviews' });
  }
});

shopRouter.post('/reviews', authenticate, async (req: AuthRequest, res) => {
  try {
    const { productId, orderId, rating, pros, cons, comment, images } = req.body;
    if (!productId || !rating) {
      res.status(400).json({ ok: false, error: 'productId and rating are required' });
      return;
    }
    if (rating < 1 || rating > 5) {
      res.status(400).json({ ok: false, error: 'rating must be between 1 and 5' });
      return;
    }

    const review = await prisma.shopReview.create({
      data: {
        id: uid(),
        productId,
        userId: req.user!.id,
        clinicId: req.user!.clinicId || null,
        orderId: orderId || null,
        rating,
        pros: pros || null,
        cons: cons || null,
        comment: comment || null,
        images: images || null,
      },
    });

    const agg = await prisma.shopReview.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.product.update({
      where: { id: productId },
      data: {
        reviewCount: agg._count.rating,
        rating: agg._avg.rating ?? null,
      },
    });

    res.status(201).json({ ok: true, data: review });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(409).json({ ok: false, error: 'You have already reviewed this product for this order' });
      return;
    }
    console.error('Failed to create review:', error);
    res.status(500).json({ ok: false, error: 'Failed to create review' });
  }
});

shopRouter.patch('/reviews/:id/helpful', async (req, res) => {
  try {
    const { id } = req.params;
    const review = await prisma.shopReview.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
    });
    res.json({ ok: true, data: { helpfulCount: review.helpfulCount } });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to mark review as helpful' });
  }
});

shopRouter.get('/delivery-zones', async (req, res) => {
  try {
    const { supplierId } = req.query;
    const where: Record<string, unknown> = { isActive: true };
    if (supplierId && typeof supplierId === 'string') {
      where.supplierId = supplierId;
    }
    const zones = await prisma.deliveryZone.findMany({
      where,
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { cost: 'asc' },
    });
    res.json({ ok: true, data: zones });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch delivery zones' });
  }
});

shopRouter.post('/delivery-zones', authenticate, async (req: AuthRequest, res) => {
  try {
    const { supplierId, name, cities, cost, freeFrom, estimatedDays } = req.body;
    if (!supplierId || !name) {
      res.status(400).json({ ok: false, error: 'supplierId and name are required' });
      return;
    }
    const zone = await prisma.deliveryZone.create({
      data: {
        id: uid(),
        supplierId,
        name,
        cities: cities || null,
        cost: cost ?? 0,
        freeFrom: freeFrom || null,
        estimatedDays: estimatedDays || null,
      },
    });
    res.status(201).json({ ok: true, data: zone });
  } catch (error) {
    console.error('Failed to create delivery zone:', error);
    res.status(500).json({ ok: false, error: 'Failed to create delivery zone' });
  }
});

shopRouter.patch('/delivery-zones/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const zone = await prisma.deliveryZone.update({ where: { id }, data: req.body });
    res.json({ ok: true, data: zone });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to update delivery zone' });
  }
});

shopRouter.delete('/delivery-zones/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.deliveryZone.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to delete delivery zone' });
  }
});

shopRouter.get('/banners', async (_req, res) => {
  try {
    const now = new Date();
    const banners = await prisma.shopBanner.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null, endDate: null },
          { startDate: null, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ ok: true, data: banners });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch banners' });
  }
});

shopRouter.post('/banners', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { title, subtitle, imageUrl, linkUrl, color, sortOrder, startDate, endDate } = req.body;
    if (!imageUrl) {
      res.status(400).json({ ok: false, error: 'imageUrl is required' });
      return;
    }
    const banner = await prisma.shopBanner.create({
      data: {
        id: uid(),
        title: title || null,
        subtitle: subtitle || null,
        imageUrl,
        linkUrl: linkUrl || null,
        color: color || null,
        sortOrder: sortOrder ?? 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    res.status(201).json({ ok: true, data: banner });
  } catch (error) {
    console.error('Failed to create banner:', error);
    res.status(500).json({ ok: false, error: 'Failed to create banner' });
  }
});

shopRouter.patch('/banners/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const banner = await prisma.shopBanner.update({ where: { id }, data });
    res.json({ ok: true, data: banner });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to update banner' });
  }
});

shopRouter.delete('/banners/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.shopBanner.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to delete banner' });
  }
});

shopRouter.get('/promotions', async (req, res) => {
  try {
    const now = new Date();
    const { supplierId } = req.query;
    const where: Record<string, unknown> = {
      isActive: true,
      OR: [
        { startDate: null, endDate: null },
        { startDate: null, endDate: { gte: now } },
        { startDate: { lte: now }, endDate: null },
        { startDate: { lte: now }, endDate: { gte: now } },
      ],
    };
    if (supplierId && typeof supplierId === 'string') {
      where.supplierId = supplierId;
    }
    const promotions = await prisma.shopPromotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { supplier: { select: { id: true, name: true } } },
    });
    res.json({ ok: true, data: promotions });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch promotions' });
  }
});

shopRouter.post('/promotions', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, description, type, discountPercent, discountAmount, productIds, categoryIds, supplierId, minOrderAmount, usageLimit, startDate, endDate } = req.body;
    if (!title) {
      res.status(400).json({ ok: false, error: 'title is required' });
      return;
    }
    const promotion = await prisma.shopPromotion.create({
      data: {
        id: uid(),
        title,
        description: description || null,
        type: type || 'discount',
        discountPercent: discountPercent || null,
        discountAmount: discountAmount || null,
        productIds: productIds || null,
        categoryIds: categoryIds || null,
        supplierId: supplierId || null,
        minOrderAmount: minOrderAmount || null,
        usageLimit: usageLimit || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    res.status(201).json({ ok: true, data: promotion });
  } catch (error) {
    console.error('Failed to create promotion:', error);
    res.status(500).json({ ok: false, error: 'Failed to create promotion' });
  }
});

shopRouter.patch('/promotions/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    const promotion = await prisma.shopPromotion.update({ where: { id }, data });
    res.json({ ok: true, data: promotion });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to update promotion' });
  }
});

shopRouter.delete('/promotions/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.shopPromotion.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to delete promotion' });
  }
});

shopRouter.get('/suppliers', async (req, res) => {
  try {
    const cityFilter = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const suppliers = await prisma.supplier.findMany({
      where: {
        isActive: true,
        status: { in: ['verified', 'official_partner'] },
        ...(cityFilter && cityFilter !== 'all'
          ? { OR: [
              { city: { equals: cityFilter, mode: 'insensitive' } },
              { legalAddress: { contains: cityFilter, mode: 'insensitive' } },
            ] }
          : {}),
      },
      include: {
        _count: { select: { products: true } },
        products: { select: { rating: true }, take: 50 },
        deliveryZones: { where: { isActive: true }, select: { id: true, name: true, cost: true, freeFrom: true, estimatedDays: true } },
      },
      orderBy: { name: 'asc' },
      take: 100,
    });
    const data = suppliers.map((s: any) => {
      const ratings = s.products.map((p: any) => p.rating).filter((r: number | null): r is number => r != null);
      const rating = ratings.length
        ? Number((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1))
        : null;
      return {
        id: s.id,
        name: s.name,
        kind: s.kind,
        status: s.status,
        rating,
        description: s.description || null,
        logo: s.logo || null,
        productCount: s._count.products,
        city: resolveSupplierCity(s),
        legalAddress: s.legalAddress,
        phone: s.phone,
        email: s.email,
        deliveryZones: s.deliveryZones,
        minOrderPrice: s.minOrderPrice,
      };
    });
    res.json({ ok: true, data });
  } catch (error) {
    console.error('Failed to fetch suppliers:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch suppliers' });
  }
});

shopRouter.post('/orders', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user?.isGuest) {
      res.status(403).json({ ok: false, error: 'Войдите в аккаунт, чтобы оформить заказ' });
      return;
    }

    const {
      items, total, dentCashMinor, dentCashTenge,
      delivery_address, delivery_method, delivery_method_id, payment_method, notes,
      clinic_id, clinicId: bodyClinicId,
      recipient_name, recipient_phone,
    } = req.body;

    let clinicId = req.user?.clinicId || null;
    const requestedClinic = clinic_id || bodyClinicId || null;
    if (!clinicId && requestedClinic) {
      const member = await prisma.clinicMember.findFirst({
        where: { userId: req.user!.id, clinicId: String(requestedClinic) },
      });
      if (member) clinicId = member.clinicId;
    }
    if (!clinicId) {
      const first = await prisma.clinicMember.findFirst({
        where: { userId: req.user!.id },
        orderBy: { joinedAt: 'asc' },
      });
      clinicId = first?.clinicId || null;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ ok: false, error: 'items array is required' });
      return;
    }

    const productIds = items.map((i: any) => String(i.product_id || i.productId || i.id || '')).filter(Boolean);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    const lines: Array<{
      productId: string;
      name: string;
      category: string | null;
      priceTenge: number;
      qty: number;
      supplierId: string | null;
      ownBrand: boolean;
      promo: boolean;
    }> = [];

    let goodsTotal = 0;
    let primarySupplierId: string | null = null;
    for (const raw of items) {
      const pid = String(raw.product_id || raw.productId || raw.id || '');
      const qty = Math.max(1, Number(raw.quantity || raw.qty || 1));
      const p = byId.get(pid);
      if (!p) {
        res.status(400).json({ ok: false, error: `Товар не найден: ${pid}` });
        return;
      }
      const lineTotal = Number(p.price) * qty;
      goodsTotal += lineTotal;
      const promo = String(p.description || '').includes('[АКЦИЯ]');
      if (!primarySupplierId && p.supplierId) primarySupplierId = p.supplierId;
      lines.push({
        productId: p.id,
        name: p.name,
        category: p.category,
        priceTenge: Number(p.price),
        qty,
        supplierId: p.supplierId,
        ownBrand: !!(p as any).ownBrand,
        promo,
      });
    }

    let deliveryCost = 0;
    if (delivery_method_id && typeof delivery_method_id === 'string') {
      const zone = await prisma.deliveryZone.findUnique({ where: { id: delivery_method_id } });
      if (zone) {
        deliveryCost = (zone.freeFrom && goodsTotal >= zone.freeFrom) ? 0 : zone.cost;
      }
    } else {
      deliveryCost = goodsTotal >= 50000 ? 0 : 2500;
    }

    const payableBeforeCash = goodsTotal + deliveryCost;
    const { spendDentCash } = await import('../dentcash/spend.service.js');
    const { accrueShopOrderCashback } = await import('../dentcash/cashback.engine.js');
    const { tengeToMinor } = await import('../../lib/money.js');

    const orderId = uid();
    let spendWanted = 0n;
    if (dentCashMinor != null) spendWanted = BigInt(dentCashMinor);
    else if (dentCashTenge != null) spendWanted = tengeToMinor(Number(dentCashTenge));

    void total;
    let order = await prisma.order.create({
      data: {
        id: orderId,
        clinicId,
        userId: req.user!.id,
        items: lines.map((l) => ({
          product_id: l.productId,
          name: l.name,
          quantity: l.qty,
          price: l.priceTenge,
          supplier_id: l.supplierId,
        })),
        total: payableBeforeCash,
        status: 'pending',
        deliveryAddress: delivery_address || null,
        deliveryMethod: delivery_method || null,
        deliveryCost,
        paymentMethod: payment_method || null,
        recipientName: recipient_name || null,
        recipientPhone: recipient_phone || null,
        notes: notes || null,
        supplierId: primarySupplierId,
        meta: {
          goodsTotal,
          deliveryCost,
          dentCashMinor: '0',
          dentCashTenge: 0,
        },
      },
    });

    let spent = 0n;
    try {
      spent = await spendDentCash({
        userId: req.user!.id,
        amountMinor: spendWanted,
        payableMinor: tengeToMinor(payableBeforeCash),
        refType: 'order',
        refId: orderId,
      });
    } catch (err) {
      console.error('[dentcash spend order]', err);
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled', meta: { ...(order.meta as object || {}), cancelReason: 'dentcash_spend_failed' } },
      }).catch(() => null);
      res.status(500).json({ ok: false, error: 'Не удалось списать DentCash' });
      return;
    }

    const finalTotal = Math.max(0, payableBeforeCash - Number(spent) / 100);
    order = await prisma.order.update({
      where: { id: orderId },
      data: {
        total: finalTotal,
        meta: {
          goodsTotal,
          deliveryCost,
          dentCashMinor: spent.toString(),
          dentCashTenge: Number(spent) / 100,
        },
      },
    });

    const cashback = await accrueShopOrderCashback({
      orderId: order.id,
      userId: req.user!.id,
      lines,
      immediate: false,
      spendMinor: spent,
    }).catch(async (err) => {
      console.error('[dentcash accrue order]', err);
      return null;
    });

    const earnTenge = cashback && !cashback.skipped
      ? Number(cashback.totalMinor) / 100
      : cashback?.skipped && cashback.reason === 'already_accrued'
        ? Number(cashback.totalMinor) / 100
        : 0;

    let payment: Record<string, unknown> | null = null;
    const method = String(payment_method || 'kaspi').toLowerCase();
    const needsOnlinePay = finalTotal > 0 && method !== 'cash';

    if (finalTotal <= 0) {
      const { settlePaidPayment } = await import('../payments/payments.routes.js');
      await settlePaidPayment({
        id: `dentcash-${order.id}`,
        refType: 'order',
        refId: order.id,
        domain: 'shop',
        sellerType: null,
        sellerId: null,
        amount: 0n,
        meta: { userId: req.user!.id, coveredByDentCash: true },
      });
      order = await prisma.order.findUnique({ where: { id: order.id } }) || order;
    } else if (needsOnlinePay) {
      const { providers, withPaymentQr } = await import('../payments/kaspi.provider.js');
      const { tengeToMinor: toMinor, serializeBigInt } = await import('../../lib/money.js');
      const amountMinor = toMinor(finalTotal);
      const gateway = providers.kaspi_qr;
      const created = await gateway.createPayment({ amountMinor, refId: order.id });
      const pay = await prisma.payment.create({
        data: {
          provider: 'kaspi_qr',
          externalId: created.externalId,
          amount: amountMinor,
          status: 'pending',
          refType: 'order',
          refId: order.id,
          domain: 'shop',
          sellerType: primarySupplierId ? 'SUPPLIER' : null,
          sellerId: primarySupplierId,
          meta: {
            qr: created.qr,
            userId: req.user!.id,
            payment_method: method,
          },
        },
      });
      payment = withPaymentQr(serializeBigInt(pay) as Record<string, unknown>, created.qr);
      const prevMeta = (order.meta && typeof order.meta === 'object' ? order.meta : {}) as Record<string, unknown>;
      order = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'awaiting_payment',
          meta: { ...prevMeta, paymentId: pay.id },
        },
      });
    }

    res.status(201).json({
      ok: true,
      data: {
        ...order,
        dentCashSpentTenge: Number(spent) / 100,
        dentCashEarnPendingTenge: earnTenge,
        dentCashEarnSkipped: cashback?.skipped ? cashback.reason : null,
        payment,
        requiresPayment: !!payment,
      },
    });
  } catch (error) {
    console.error('Create shop order error:', error);
    res.status(500).json({ ok: false, error: 'Failed to create order' });
  }
});

shopRouter.get('/orders', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const { skip, take } = paginate(page, limit);

    const where = { userId };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          supplier: { select: { id: true, name: true, logo: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    const data = orders.map((o: any) => {
      const meta = (o.meta && typeof o.meta === 'object' ? o.meta : {}) as Record<string, unknown>;
      const rawItems = Array.isArray(o.items) ? o.items : [];
      return {
        id: o.id,
        status: o.status,
        total: o.total,
        deliveryAddress: o.deliveryAddress,
        deliveryMethod: o.deliveryMethod,
        deliveryCost: o.deliveryCost,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        recipientName: o.recipientName,
        recipientPhone: o.recipientPhone,
        notes: o.notes,
        supplier: o.supplier ? { id: o.supplier.id, name: o.supplier.name, logo: (o.supplier as any).logo } : null,
        items: rawItems.map((it: any, idx: number) => ({
          id: it.id || `${o.id}-${idx}`,
          productId: it.product_id || null,
          productName: it.productName || it.name || 'Товар',
          quantity: Number(it.quantity || it.qty || 1),
          price: Number(it.price || 0),
        })),
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        meta,
      };
    });

    res.json({ ok: true, data: paginatedResponse(data, total, page, limit) });
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch orders' });
  }
});

shopRouter.post('/favorites', authenticate, async (req: AuthRequest, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user!.id;

    if (!productId) {
      res.status(400).json({ ok: false, error: 'productId is required' });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      res.status(404).json({ ok: false, error: 'Product not found' });
      return;
    }

    const existing = await prisma.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      res.json({ ok: true, data: { favorited: false } });
      return;
    }

    const favorite = await prisma.favorite.create({
      data: { id: uid(), userId, productId },
    });

    res.status(201).json({ ok: true, data: { favorited: true, id: favorite.id } });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to toggle favorite' });
  }
});

shopRouter.get('/favorites', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            supplier: { select: { id: true, name: true, status: true, city: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      ok: true,
      data: favorites.map((f: any) => ({
        id: f.id,
        product: buildProductResponse(f.product),
        createdAt: f.createdAt,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch favorites:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch favorites' });
  }
});

shopRouter.get('/recommendations', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const { limit: limitParam, strategy } = req.query;
    const take = Math.min(20, Math.max(1, parseInt(String(limitParam || '8'))));

    const strat = String(strategy || 'trending').toLowerCase();

    let userCategoryIds: string[] = [];
    let userProductIds: string[] = [];
    if (userId && strat === 'personalized') {
      const recentOrders = await prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { items: true },
      });
      const allItems: Array<{ product_id: string; name: string; category?: string }> = [];
      for (const o of recentOrders) {
        if (Array.isArray(o.items)) {
          allItems.push(...o.items.map((i: any) => ({ product_id: i.product_id, name: i.name, category: i.category })));
        }
      }
      userProductIds = allItems.map((i) => i.product_id).filter(Boolean);
      const orderedProducts = await prisma.product.findMany({
        where: { id: { in: userProductIds } },
        select: { categoryId: true },
      });
      userCategoryIds = [...new Set(orderedProducts.map((p) => p.categoryId).filter(Boolean))] as string[];
    }

    let products;
    if (strat === 'personalized' && userCategoryIds.length > 0) {
      products = await prisma.product.findMany({
        where: {
          isActive: true,
          categoryId: { in: userCategoryIds },
          id: { notIn: userProductIds },
        },
        orderBy: { rating: 'desc' },
        take,
        include: {
          supplier: { select: { id: true, name: true, status: true, city: true, legalAddress: true } },
        },
      });
    } else {
      products = await prisma.product.findMany({
        where: { isActive: true, stock: { gt: 0 } },
        orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }, { createdAt: 'desc' }],
        take,
        include: {
          supplier: { select: { id: true, name: true, status: true, city: true, legalAddress: true } },
        },
      });
    }

    if (products.length > 4) {
      for (let i = products.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [products[i], products[j]] = [products[j], products[i]];
      }
    }

    res.json({
      ok: true,
      data: products.map(buildProductResponse),
      strategy: strat,
    });
  } catch (error) {
    console.error('Failed to fetch recommendations:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch recommendations' });
  }
});

export { shopRouter };
