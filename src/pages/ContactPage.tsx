import { Linkedin } from "lucide-react";
import { PageIntro } from "../components/PageIntro";
import { siteConfig } from "../config/site";

export function ContactPage() {
  return (
    <>
      <PageIntro title="Get in touch.">
        Got a project, an idea or something that needs the right words? I'd love
        to hear about it.
      </PageIntro>
      <section className="page-shell">
        <div className="contact-card">
          <div>
            <p className="eyebrow">Let’s talk</p>
            <h2>Let’s connect.</h2>
            <p>
              Find me on LinkedIn and tell me a little about yourself and what
              you're working on.
            </p>
          </div>
          <a
            className="button"
            href={siteConfig.linkedIn}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Linkedin className="size-4" /> Connect on LinkedIn
          </a>
        </div>
      </section>
    </>
  );
}
