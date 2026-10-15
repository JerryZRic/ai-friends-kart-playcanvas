// Keep the tiny, network-independent cold-entry controller identical everywhere.
// Run after editing src/brand-intro-bootstrap.js or src/brand-intro.css.
import {readFileSync, writeFileSync} from 'node:fs';
const script = readFileSync('src/brand-intro-bootstrap.js', 'utf8');
const style = readFileSync('src/brand-intro.css', 'utf8');
for (const page of ['index.html', 'garage.html', 'coast.html', 'waterpark.html']) {
  let html = readFileSync(page, 'utf8');
  html = html.replace(/<style data-brand-intro-style>[\s\S]*?<\/style>/, `<style data-brand-intro-style>\n${style}</style>`);
  html = html.replace(/<script data-brand-intro-bootstrap>[\s\S]*?<\/script>/, '');
  html = html.replace('<aside id="startup-recovery"', `<script data-brand-intro-bootstrap>\n${script}</script><aside id="startup-recovery"`);
  html = html.replace("var intro=document.getElementById('brand-intro');if(intro)intro.remove();", "window.__timewishIntro?.finish();var intro=document.getElementById('brand-intro');if(intro)intro.remove();");
  // Idempotent even after the recovery integration was already generated.
  html = html.replace(/(?:window\.__timewishIntro\?\.finish\(\);){2,}/g, 'window.__timewishIntro?.finish();');
  writeFileSync(page, html);
}
