import katex from "katex";
import { cn } from "@/lib/utils";

/**
 * TeX rendered to HTML with KaTeX on the server, so the page ships no math script. Include
 * `katex/dist/katex.min.css` on any page that uses it. MathML is rendered alongside for screen readers.
 */
export function MathTex({
  tex,
  display = false,
  className,
}: {
  tex: string;
  display?: boolean;
  className?: string;
}) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: true,
    output: "htmlAndMathml",
  });
  const Tag = display ? "div" : "span";
  return (
    <Tag
      className={cn(display && "-mx-1 overflow-x-auto overflow-y-hidden px-1 py-1", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
