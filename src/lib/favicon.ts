/** Point the browser tab's <link rel="icon"> at `href`, creating it if absent. */
export function applyFavicon(href: string | null | undefined): void {
  if (typeof document === "undefined" || !href) return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}
