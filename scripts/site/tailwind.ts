import * as path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import typography from "@tailwindcss/typography";
import daisyui from "daisyui";

export async function compileTailwindCss(
  repoRoot: string,
  distRoot: string
): Promise<string> {
  const inputCss = `
@tailwind base;
@tailwind components;
@tailwind utilities;
`;

  const result = await postcss([
    tailwindcss({
      content: [
        path.join(repoRoot, "scripts/site/**/*.ts"),
        path.join(repoRoot, "scripts/site/**/*.tsx"),
        path.join(distRoot, "**/*.html"),
      ],
      theme: {
        extend: {},
      },
      plugins: [typography, daisyui],
      daisyui: {
        themes: ["night", "winter"],
        darkTheme: "night",
        logs: false,
      },
    } as Parameters<typeof tailwindcss>[0]),
  ]).process(inputCss, { from: undefined });

  return result.css;
}
