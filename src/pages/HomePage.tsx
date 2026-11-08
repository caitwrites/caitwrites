import {
  ArrowRight,
  Layers3,
  Laptop,
  Linkedin,
  Mail,
  PenLine,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PortfolioRecord } from "../../shared/types";
import { siteConfig } from "../config/site";
import { PortfolioCard } from "../components/PortfolioCard";
import { getPortfolio, staticPortfolioRecords } from "../lib/portfolio";

const skills = [
  { label: "Web Copy", Icon: Laptop },
  { label: "Blog Writing", Icon: PenLine },
  { label: "SEO-Friendly Copy", Icon: TrendingUp },
  { label: "Email Copy", Icon: Mail },
  { label: "Social Media", Icon: Smartphone },
  { label: "Content Strategy", Icon: Layers3 },
];

export function HomePage() {
  const [favourites, setFavourites] = useState<PortfolioRecord[]>(() =>
    staticPortfolioRecords
      .filter((record) => record.favourite)
      .sort((a, b) => b.displayOrder - a.displayOrder)
      .slice(0, 8),
  );
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      (["blog", "web-copy", "social-media"] as const).map((category) =>
        getPortfolio(
          { category, favourites: true, page: 1, pageSize: 8 },
          controller.signal,
        ),
      ),
    )
      .then((results) =>
        setFavourites(
          results
            .flatMap((result) => result.records)
            .sort((a, b) => b.displayOrder - a.displayOrder)
            .slice(0, 8),
        ),
      )
      .catch((error: unknown) => {
        if ((error as Error).name !== "AbortError")
          console.error("Featured work could not be refreshed.", error);
      });
    return () => controller.abort();
  }, []);
  return (
    <>
      <section className="page-shell hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">{siteConfig.eyebrow}</p>
          <h1>
            Hi, I’m Cait.
            <br />I write words that <span>work.</span>
          </h1>
          <p>{siteConfig.intro}</p>
          <div className="mt-7 flex flex-wrap items-center gap-5">
            <a
              className="button"
              href={siteConfig.linkedIn}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin className="size-4" /> Connect on LinkedIn
            </a>
          </div>
        </div>
        <div className="hero-image">
          <picture>
            <source
              media="(max-width: 767px)"
              srcSet="/images/cait-hero-mobile.webp"
            />
            <img
              src="/images/cait-hero-desktop.webp"
              width={1402}
              height={1122}
              alt="Cait smiling outdoors in a garden."
            />
          </picture>
        </div>
      </section>

      <section
        className="skills-strip page-shell"
        aria-label="Skills and expertise"
      >
        <div className="skills-list">
          {skills.map(({ label, Icon }) => (
            <div className="skill-item" key={label}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="page-shell pt-7" aria-labelledby="highlights-heading">
        <div className="section-heading">
          <h2 id="highlights-heading">Highlights.</h2>
          <Link to="/web-copy">
            View more <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="portfolio-grid home-grid">
          {favourites.map((record) => (
            <PortfolioCard record={record} key={record.id} />
          ))}
        </div>
      </section>
    </>
  );
}
