import { Check, Linkedin } from 'lucide-react';
import { PageIntro } from '../components/PageIntro';
import { siteConfig } from '../config/site';

export function AboutPage() {
  return (
    <>
      <PageIntro title="About Cait.">A considered introduction to the writer, the work and the thinking that brings the two together.</PageIntro>
      <section className="page-shell about-grid">
        <div className="about-panel lavender"><p className="eyebrow">Biography</p><h2>Words with intention.</h2><p>{siteConfig.about.biography}</p></div>
        <div className="about-panel"><p className="eyebrow">Experience</p><h2>Built across formats.</h2><p>{siteConfig.about.experience}</p><ul>{['Blog writing', 'Short- and long-form web copy', 'Informational content', 'Social media copy', 'Content strategy'].map((skill) => <li key={skill}><Check className="size-4" /> {skill}</li>)}</ul></div>
        <div className="about-panel"><p className="eyebrow">Companies worked with</p><h2>Selected companies.</h2><div className="company-list">{siteConfig.companies.map((company) => <span key={company}>{company}</span>)}</div></div>
        <div className="about-panel dark"><p className="eyebrow">Professional approach</p><h2>Clear, useful, human.</h2><p>{siteConfig.about.approach}</p><a className="inline-link text-white" href={siteConfig.linkedIn} target="_blank" rel="noopener noreferrer"><Linkedin className="size-5" /> Connect on LinkedIn</a></div>
      </section>
    </>
  );
}
