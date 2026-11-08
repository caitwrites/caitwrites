import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { Category } from "../../shared/types";
import { siteConfig } from "../config/site";
import { FilterControls } from "../components/FilterControls";
import { Pagination } from "../components/Pagination";
import { PageIntro } from "../components/PageIntro";
import { PortfolioCard } from "../components/PortfolioCard";
import { EmptyState, ErrorState, LoadingGrid } from "../components/States";
import { usePortfolio } from "../hooks/usePortfolio";
import { useResponsivePageSize } from "../hooks/useResponsivePageSize";
import {
  queryForCategory,
  setFilterParam,
  sortFilterOptions,
} from "../lib/portfolio";
import { companySlug } from "../../shared/portfolio";

const companyOptions = sortFilterOptions([
  { label: "All Companies", value: "" },
  ...siteConfig.companies.map((company) => ({
    label: company,
    value: companySlug(company),
  })),
]);

const copy = {
  blog: {
    title: "Blogs.",
    intro:
      "Well-researched, engaging blog content that makes topics easy to understand and enjoyable to read.",
  },
  "web-copy": {
    title: "Web Copy.",
    intro:
      "I write punchy landing pages, detailed guides and everything in between, making sure every page is clear, engaging and easy to navigate.",
  },
  "social-media": {
    title: "Social Media.",
    intro:
      "Social copy with personality that feels at home on each platform and gives people something to talk about.",
  },
};

export function GalleryPage({ category }: { category: Category }) {
  const [params, setParams] = useSearchParams();
  const pageSize = useResponsivePageSize();
  const query = useMemo(
    () => queryForCategory(category, params, pageSize),
    [category, params, pageSize],
  );
  const { data, loading, error } = usePortfolio(query);
  const galleryRef = useRef<HTMLDivElement>(null);
  const pageCopy = copy[category];
  const filters = [
    { key: "company", label: "Company", options: companyOptions },
    ...(category === "web-copy"
      ? [
          {
            key: "type",
            label: "Content type",
            options: sortFilterOptions([
              { label: "All Types", value: "" },
              { label: "Short-form", value: "short-form" },
              { label: "Long-form", value: "long-form" },
              { label: "Informational", value: "informational" },
            ]),
          },
        ]
      : []),
    ...(category === "social-media"
      ? [
          {
            key: "platform",
            label: "Platform",
            options: sortFilterOptions([
              { label: "All Platforms", value: "" },
              { label: "Instagram", value: "instagram" },
              { label: "Facebook", value: "facebook" },
              { label: "LinkedIn", value: "linkedin" },
            ]),
          },
        ]
      : []),
  ];
  const values = Object.fromEntries(
    filters.map((filter) => [filter.key, params.get(filter.key) || ""]),
  );
  const active = Object.values(values).some(Boolean);

  useEffect(() => {
    if (data && data.page !== query.page) {
      const next = new URLSearchParams(params);
      data.page === 1
        ? next.delete("page")
        : next.set("page", String(data.page));
      setParams(next, { replace: true });
    }
  }, [data?.page, query.page]);

  const changeFilter = (key: string, value: string) =>
    setParams(setFilterParam(params, key, value));
  const clear = () => setParams(new URLSearchParams());
  const changePage = (page: number) => {
    const next = new URLSearchParams(params);
    page === 1 ? next.delete("page") : next.set("page", String(page));
    setParams(next);
    galleryRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  return (
    <>
      <PageIntro title={pageCopy.title}>{pageCopy.intro}</PageIntro>
      <section
        className="page-shell"
        aria-label={`${pageCopy.title.replace(".", "")} portfolio`}
      >
        <FilterControls
          filters={filters}
          values={values}
          onChange={changeFilter}
          onClear={clear}
          active={active}
          showClear={!(data && !loading && data.total === 0)}
        />
        <div className="gallery-results" ref={galleryRef}>
          {data && data.total > 0 && (
            <p className="results-count" aria-live="polite">
              {data.total} {data.total === 1 ? "result" : "results"}
            </p>
          )}
          {loading ? (
            <LoadingGrid />
          ) : error ? (
            <ErrorState
              message={error}
              onRetry={() => window.location.reload()}
            />
          ) : data && data.records.length ? (
            <>
              <div className="portfolio-grid">
                {data.records.map((record) => (
                  <PortfolioCard record={record} key={record.id} />
                ))}
              </div>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onPage={changePage}
              />
            </>
          ) : (
            <EmptyState onClear={clear} showClear={active} />
          )}
        </div>
      </section>
    </>
  );
}
