import { getTranslations } from "@/lib/get-locale";
import { prisma } from "@/lib/db";
import { KnowledgeContent } from "@/components/knowledge-content";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    crop?: string;
    page?: string;
    edit?: string;
    add?: string;
  }>;
}) {
  const t = await getTranslations();
  const { q, category, crop, page: pageStr, edit, add } = await searchParams;
  const page = Math.max(1, Number(pageStr) || 1);
  const perPage = 20;
  const skip = (page - 1) * perPage;

  const where = {
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { content: { contains: q } },
            { id: { contains: q } },
            { categories: { some: { category: { contains: q } } } },
            { crops: { some: { crop: { contains: q } } } },
          ],
        }
      : {}),
    ...(category ? { categories: { some: { category } } } : {}),
    ...(crop ? { crops: { some: { crop } } } : {}),
  };

  const [items, total, catGroups, cropGroups, taxTerms] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        categories: { select: { category: true } },
        crops: { select: { crop: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.article.count({ where }),
    prisma.articleCategory.groupBy({
      by: ["category"],
      _count: { _all: true },
    }),
    prisma.articleCrop.groupBy({
      by: ["crop"],
      _count: { _all: true },
    }),
    // Full admin-managed taxonomy so freshly added labels show up in the
    // filters immediately (groupBy alone only lists labels already in use).
    prisma.taxonomyTerm.findMany({
      orderBy: [{ type: "asc" }, { en: "asc" }],
    }),
  ]);

  const usedCategories = catGroups
    .sort((a, b) => (b._count._all ?? 0) - (a._count._all ?? 0))
    .map((g) => g.category);
  const usedCrops = cropGroups
    .sort((a, b) => (b._count._all ?? 0) - (a._count._all ?? 0))
    .map((g) => g.crop);
  const taxCats = taxTerms.filter((t) => t.type === "category").map((t) => t.value);
  const taxCrops = taxTerms.filter((t) => t.type === "crop").map((t) => t.value);

  const allCategories = [...new Set([...usedCategories, ...taxCats])];
  const allCrops = [...new Set([...usedCrops, ...taxCrops])];

  // Deep link from feedback review (/feedback "Update" button): load the
  // article to edit regardless of pagination/filters.
  const editArticleRow = edit
    ? await prisma.article.findUnique({
        where: { id: edit },
        include: {
          categories: { select: { category: true } },
          crops: { select: { crop: true } },
        },
      })
    : null;

  return (
    <KnowledgeContent
      articles={items as never}
      total={total}
      page={page}
      q={q ?? ""}
      category={category ?? ""}
      crop={crop ?? ""}
      allCategories={allCategories}
      allCrops={allCrops}
      editArticle={(editArticleRow ?? undefined) as never}
      openAdd={add === "1"}
      pageLabel={t.knowledge.title}
      totalLabel={t.knowledge.articles}
      filteredLabel={t.knowledge.filtered}
      noArticles={t.knowledge.noArticles}
      titleCol={t.knowledge.titleCol}
      categoriesLabel={t.knowledge.categories}
      cropsLabel={t.knowledge.crops}
      languageLabel={t.knowledge.language}
      updatedLabel={t.knowledge.updated}
      newArticleLabel={t.knowledge.newArticle}
      searchPlaceholder={t.knowledge.searchPlaceholder}
      allCategoriesLabel={t.knowledge.allCategories}
      allCropsLabel={t.knowledge.allCrops}
      filterLabel={t.knowledge.filter}
      createdMsg={t.knowledge.created}
      updatedMsg={t.knowledge.updatedMsg}
      deletedMsg={t.knowledge.deleted}
      deleteFailedMsg={t.knowledge.deleteFailed}
      confirmTitle={t.knowledge.confirmDeleteTitle}
      confirmDeleteMsg={t.knowledge.confirmDeleteMsg}
      editTitle={t.knowledge.editArticle}
      addTitle={t.knowledge.addArticle}
      actionsLabel={t.knowledge.actions}
    />
  );
}
