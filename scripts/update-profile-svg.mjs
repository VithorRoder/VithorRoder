import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(repositoryRoot, "assets", "profile-dashboard.template.svg");
const outputPath = path.join(repositoryRoot, "assets", "profile-dashboard.svg");

const activityStart = "<!-- ACTIVITY_START -->";
const activityEnd = "<!-- ACTIVITY_END -->";

const graphUrl = new URL("https://github-readme-activity-graph.vercel.app/graph");
graphUrl.searchParams.set("username", "VithorRoder");
graphUrl.searchParams.set("bg_color", "0D1117");
graphUrl.searchParams.set("color", "C9D1D9");
graphUrl.searchParams.set("line", "58A6FF");
graphUrl.searchParams.set("point", "FFFFFF");
graphUrl.searchParams.set("area", "true");
graphUrl.searchParams.set("hide_border", "true");
graphUrl.searchParams.set("refresh", String(Date.now()));

function useArialOnly(source) {
  return source
    .replace(/font-family\s*:\s*[^;}]+/gi, "font-family:Arial")
    .replace(/font-family="[^"]*"/gi, 'font-family="Arial"')
    .replace(/font-family='[^']*'/gi, "font-family='Arial'");
}

function extractSvgInner(source) {
  const match = source.match(/<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/i);
  if (!match) {
    throw new Error("The activity service did not return a valid SVG document.");
  }
  return match[1];
}

function buildActivityRegion(source) {
  let inner = extractSvgInner(source);

  inner = inner.replace(
    /<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi,
    '<text x="600" y="35" text-anchor="middle" fill="#C9D1D9" font-family="Arial" font-size="18" font-weight="600">Vithor Roder\'s Contribution Graph</text>',
  );
  inner = useArialOnly(inner);

  return `${activityStart}
    <svg x="44" y="1620" width="1312" height="459.2" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid meet">
${inner.trim()}
    </svg>
    ${activityEnd}`;
}

function replaceActivityRegion(template, activityRegion) {
  const startIndex = template.indexOf(activityStart);
  const endIndex = template.indexOf(activityEnd);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("Activity markers are missing or invalid in the dashboard template.");
  }

  return `${template.slice(0, startIndex)}${activityRegion}${template.slice(endIndex + activityEnd.length)}`;
}

function validateOutput(source) {
  if (/<image\b|data:image|foreignObject/i.test(source)) {
    throw new Error("Generated SVG contains an embedded image or unsupported foreignObject.");
  }

  const nonArialDeclarations = source.match(/font-family(?:\s*:|=)[^;}>]+/gi) ?? [];
  const invalid = nonArialDeclarations.filter((declaration) => !/Arial/i.test(declaration));
  if (invalid.length > 0) {
    throw new Error(`Generated SVG contains non-Arial fonts: ${invalid.join(", ")}`);
  }
}

const response = await fetch(graphUrl, {
  headers: {
    Accept: "image/svg+xml",
    "User-Agent": "VithorRoder-profile-dashboard",
  },
});

if (!response.ok) {
  throw new Error(`Activity graph request failed: ${response.status} ${response.statusText}`);
}

const [template, graphSvg] = await Promise.all([
  readFile(templatePath, "utf8"),
  response.text(),
]);

const generated = useArialOnly(replaceActivityRegion(template, buildActivityRegion(graphSvg)));
validateOutput(generated);

const previous = await readFile(outputPath, "utf8").catch(() => "");
if (generated !== previous) {
  await writeFile(outputPath, generated, "utf8");
  console.log("Updated assets/profile-dashboard.svg");
} else {
  console.log("Profile dashboard is already current");
}
