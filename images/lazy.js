/**
 * ImagesLazy — lazy-load images via IntersectionObserver.
 *
 * Put `data-src="..."` on an <img> and call `lazy.observe(img)`. The `src`
 * attribute gets filled in once the element scrolls into view, then the
 * observer stops watching that element.
 *
 * Works with any URL source: direct Storage URLs, data URLs, or
 * Object URLs from `mb.images.download()`.
 */
export class ImagesLazy {
  constructor(options = {}) {
    this.rootMargin = options.rootMargin || "200px";
    this.threshold = options.threshold || 0;
    this._observer = null;
  }

  /** Observe a single element, NodeList, or array of elements. */
  observe(target) {
    const observer = this._ensureObserver();
    const elements =
      target && typeof target !== "string" && target[Symbol.iterator]
        ? [...target]
        : [target];
    for (const el of elements) observer.observe(el);
  }

  /** Stop observing, disconnect the underlying IntersectionObserver. */
  disconnect() {
    this._observer?.disconnect();
    this._observer = null;
  }

  _ensureObserver() {
    if (this._observer) return this._observer;
    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          const src = el.getAttribute("data-src");
          if (src) {
            el.src = src;
            el.removeAttribute("data-src");
          }
          this._observer.unobserve(el);
        }
      },
      { rootMargin: this.rootMargin, threshold: this.threshold }
    );
    return this._observer;
  }
}
