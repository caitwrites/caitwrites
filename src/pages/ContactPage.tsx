import { Linkedin } from 'lucide-react';
import { PageIntro } from '../components/PageIntro';
import { siteConfig } from '../config/site';

export function ContactPage() {
  return (
    <>
      <PageIntro title="Get in touch.">Have a project in mind? I’d love to hear what you’re working on and how thoughtful copy could help.</PageIntro>
      <section className="page-shell"><div className="contact-card"><div><p className="eyebrow">Let’s talk</p><h2>Let’s connect.</h2><p>Send me a message on LinkedIn to introduce yourself, share your project and start the conversation.</p></div><a className="button" href={siteConfig.linkedIn} target="_blank" rel="noopener noreferrer"><Linkedin className="size-4" /> Connect on LinkedIn</a></div></section>
    </>
  );
}
