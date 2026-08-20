import "./styles.css";
import { renderMarkdown } from "./md";

import overview from "../../../packages/kamvachart/docs/index.md?raw";
import gettingStarted from "../../../packages/kamvachart/docs/getting-started.md?raw";
import api from "../../../packages/kamvachart/docs/api.md?raw";
import indicators from "../../../packages/kamvachart/docs/indicators.md?raw";
import concepts from "../../../packages/kamvachart/docs/concepts.md?raw";
import interaction from "../../../packages/kamvachart/docs/interaction.md?raw";
import extending from "../../../packages/kamvachart/docs/extending.md?raw";

interface Doc {
  id: string;
  title: string;
  md: string;
}

const docs: Doc[] = [
  { id: "overview", title: "Overview", md: overview },
  { id: "getting-started", title: "Getting started", md: gettingStarted },
  { id: "api", title: "API reference", md: api },
  { id: "indicators", title: "Indicators", md: indicators },
  { id: "concepts", title: "Concepts", md: concepts },
  { id: "interaction", title: "Interaction & styling", md: interaction },
  { id: "extending", title: "Extending", md: extending },
];

const navEl = document.getElementById("docs-nav") as HTMLElement;
const root = document.getElementById("docs") as HTMLElement;

for (const doc of docs) {
  const link = document.createElement("a");
  link.href = `#${doc.id}`;
  link.textContent = doc.title;
  navEl.appendChild(link);

  const section = document.createElement("section");
  section.id = doc.id;
  section.innerHTML = renderMarkdown(doc.md);
  root.appendChild(section);
}