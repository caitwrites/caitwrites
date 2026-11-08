import { Check, Linkedin } from "lucide-react";
import { PageIntro } from "../components/PageIntro";
import { siteConfig } from "../config/site";

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="about-copy">
      {text.split(/\r?\n\s*\r?\n/).map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}

export function AboutPage() {
  return (
    <>
      <PageIntro title="About Cait.">
        A little about who I am and what I do.
      </PageIntro>
      <section className="page-shell about-grid">
        <div className="about-panel lavender">
          <p className="eyebrow">Biography</p>
          <h2>Always one for words.</h2>
          <Paragraphs text={siteConfig.about.biography} />
        </div>
        <div className="about-panel">
          <p className="eyebrow">Experience</p>
          <h2>Putting my words to work.</h2>
          <Paragraphs text={siteConfig.about.experience} />
          <ul>
            {[
              "Blog writing",
              "Short- and long-form web copy",
              "Informational content",
              "Social media copy",
              "Content strategy",
            ].map((skill) => (
              <li key={skill}>
                <Check className="size-4" /> {skill}
              </li>
            ))}
          </ul>
        </div>
        <div className="about-panel">
          <p className="eyebrow">Companies worked with</p>
          <h2>Selected companies.</h2>
          <div className="company-list">
            {siteConfig.companies.map((company) => (
              <span key={company}>{company}</span>
            ))}
          </div>
        </div>
        <div className="about-panel dark">
          <p className="eyebrow">Professional approach</p>
          <h2>Curiosity meets creativity.</h2>
          <Paragraphs text={siteConfig.about.approach} />
          <a
            className="inline-link text-white"
            href={siteConfig.linkedIn}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Linkedin className="size-5" /> Connect on LinkedIn
          </a>
        </div>
      </section>
    </>
  );
}
