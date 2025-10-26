import { useEffect, useRef } from "react";

interface HTMLRendererProps {
  html: string;
}

export const HTMLRenderer = ({ html }: HTMLRendererProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Write the HTML content to the iframe
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Auto-resize iframe to content height
    const resizeIframe = () => {
      if (iframe.contentWindow) {
        const height = iframe.contentWindow.document.body.scrollHeight;
        iframe.style.height = `${height}px`;
      }
    };

    // Initial resize
    setTimeout(resizeIframe, 100);

    // Resize on window resize
    iframe.contentWindow?.addEventListener("resize", resizeIframe);

    return () => {
      iframe.contentWindow?.removeEventListener("resize", resizeIframe);
    };
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      className="w-full border-0"
      style={{ minHeight: "200px" }}
      sandbox="allow-scripts allow-same-origin"
      title="HTML Output"
    />
  );
};
