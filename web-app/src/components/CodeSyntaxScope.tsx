import { useEffect, useRef, type ReactNode } from "react";
import { renderRichText, shouldRenderRichText } from "./codeSyntaxRenderer";

function shouldEnhanceElement(element: Element) {
  if (
    element.closest(".qc-code-block, .qc-inline-code, pre, code, textarea, input, svg") ||
    element.children.length > 0
  ) {
    return false;
  }

  const text = element.textContent || "";
  if (!text.trim()) return false;

  const currentSource = element.getAttribute("data-qc-code-source");
  if (currentSource === text) return false;

  return shouldRenderRichText(text);
}

function enhanceCodeBlocks(scope: HTMLElement) {
  const candidates = Array.from(scope.querySelectorAll("h1, h2, h3, h4, p, span, div"));

  for (const element of candidates) {
    if (!shouldEnhanceElement(element)) continue;

    const text = element.textContent || "";
    element.innerHTML = renderRichText(text);
    element.setAttribute("data-qc-code-source", text);
    element.classList.add("qc-rich-text");
  }
}

export function CodeSyntaxScope({ children }: { children: ReactNode }) {
  const scopeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    let frame = 0;
    const run = () => {
      frame = 0;
      enhanceCodeBlocks(scope);
    };
    const scheduleRun = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(run);
    };

    scheduleRun();
    const observer = new MutationObserver(scheduleRun);
    observer.observe(scope, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={scopeRef}>{children}</div>;
}
