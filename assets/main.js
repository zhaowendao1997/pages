(() => {
  const root = document.querySelector("[data-lightbox-root]");
  if (!root) return;

  const links = [...document.querySelectorAll("[data-lightbox]")];
  const image = root.querySelector("[data-lb-img]");
  const caption = root.querySelector("[data-lb-caption]");
  const exif = root.querySelector("[data-lb-exif]");
  const download = root.querySelector("[data-lb-download]");
  if (!links.length || !image) return;

  let index = 0;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let baseWidth = 0;
  let baseHeight = 0;
  let baseCenterX = 0;
  let baseCenterY = 0;
  let drag = null;
  let suppressClick = false;

  const apply = () => {
    image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    const zoomed = scale > 1.001;
    image.classList.toggle("is-zoomed", zoomed);
    root.classList.toggle("is-photo-zoomed", zoomed);
  };

  const clampPan = () => {
    const maxX = Math.max(0, (baseWidth * scale - window.innerWidth) / 2 + 8);
    const maxY = Math.max(0, (baseHeight * scale - window.innerHeight) / 2 + 8);
    translateX = Math.min(maxX, Math.max(-maxX, translateX));
    translateY = Math.min(maxY, Math.max(-maxY, translateY));
  };

  const measure = () => {
    image.style.transition = "none";
    image.style.transform = "none";
    const rect = image.getBoundingClientRect();
    if (rect.width && rect.height) {
      baseWidth = rect.width;
      baseHeight = rect.height;
      baseCenterX = rect.left + rect.width / 2;
      baseCenterY = rect.top + rect.height / 2;
    }
    apply();
    void image.offsetWidth;
    image.style.transition = "";
  };

  const resetView = (animate = false) => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    drag = null;
    image.classList.remove("is-dragging");
    if (!animate) image.style.transition = "none";
    apply();
    if (!animate) {
      void image.offsetWidth;
      image.style.transition = "";
    }
  };

  const queueMeasure = () => {
    window.requestAnimationFrame(() => {
      if (image.complete && image.naturalWidth) measure();
    });
  };

  const show = (next) => {
    index = (next + links.length) % links.length;
    const link = links[index];
    image.src = link.getAttribute("href");
    image.alt = link.dataset.caption || "";
    caption.textContent = link.dataset.caption || "";
    if (exif) exif.textContent = link.dataset.exif || "";
    if (download) {
      const original = link.dataset.original || "";
      download.hidden = !original;
      download.href = original;
    }
    root.hidden = false;
    document.body.style.overflow = "hidden";
    resetView();
    queueMeasure();
  };

  const close = () => {
    root.hidden = true;
    image.src = "";
    if (exif) exif.textContent = "";
    if (download) {
      download.hidden = true;
      download.href = "";
    }
    resetView();
    document.body.style.overflow = "";
  };

  image.addEventListener("load", () => {
    if (root.hidden) return;
    resetView();
    measure();
  });

  window.addEventListener("resize", () => {
    if (root.hidden) return;
    resetView();
    measure();
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-lightbox]");
    if (!link) return;
    event.preventDefault();
    show(links.indexOf(link));
  });

  root.querySelector("[data-lb-close]").addEventListener("click", close);
  root.querySelector("[data-lb-prev]").addEventListener("click", () => show(index - 1));
  root.querySelector("[data-lb-next]").addEventListener("click", () => show(index + 1));

  document.addEventListener("keydown", (event) => {
    if (root.hidden) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") show(index - 1);
    if (event.key === "ArrowRight") show(index + 1);
  });

  root.addEventListener(
    "wheel",
    (event) => {
      if (root.hidden) return;
      event.preventDefault();
      if (!baseWidth || !baseHeight) return;

      const delta = event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * window.innerHeight
          : event.deltaY;
      const clampedDelta = Math.max(-180, Math.min(180, delta));
      const factor = Math.exp(-clampedDelta * 0.0012);
      const nextScale = Math.min(5, Math.max(1, scale * factor));
      if (Math.abs(nextScale - scale) < 0.001) return;

      const localX = (event.clientX - baseCenterX - translateX) / scale;
      const localY = (event.clientY - baseCenterY - translateY) / scale;

      translateX = event.clientX - baseCenterX - localX * nextScale;
      translateY = event.clientY - baseCenterY - localY * nextScale;
      scale = nextScale;
      clampPan();
      apply();
    },
    { passive: false }
  );

  image.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || scale <= 1) return;
    event.preventDefault();
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      tx: translateX,
      ty: translateY,
      moved: false,
    };
    image.setPointerCapture(event.pointerId);
    image.classList.add("is-dragging");
  });

  image.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (Math.abs(event.clientX - drag.x) > 4 || Math.abs(event.clientY - drag.y) > 4) {
      drag.moved = true;
    }
    translateX = drag.tx + event.clientX - drag.x;
    translateY = drag.ty + event.clientY - drag.y;
    clampPan();
    apply();
  });

  const endDrag = (event) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    image.classList.remove("is-dragging");
    if (image.hasPointerCapture?.(event.pointerId)) image.releasePointerCapture(event.pointerId);
    if (moved) {
      suppressClick = true;
      window.setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
  };

  image.addEventListener("pointerup", endDrag);
  image.addEventListener("pointercancel", endDrag);

  image.addEventListener("click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (!baseWidth || !baseHeight) return;

    if (scale > 1.001) {
      resetView(true);
      return;
    }

    const nextScale = 3;
    const localX = (event.clientX - baseCenterX - translateX) / scale;
    const localY = (event.clientY - baseCenterY - translateY) / scale;
    translateX = event.clientX - baseCenterX - localX * nextScale;
    translateY = event.clientY - baseCenterY - localY * nextScale;
    scale = nextScale;
    clampPan();
    apply();
  });
})();

/* ------------------------------------------------------- portal backdrop */

(() => {
  const root = document.querySelector("[data-portal-bg]");
  const data = document.querySelector("[data-portal-photos]");
  if (!root || !data) return;

  let photos;
  try {
    photos = JSON.parse(data.textContent);
  } catch {
    return;
  }
  if (!Array.isArray(photos) || photos.length === 0) return;

  const layers = [...root.querySelectorAll("img")];
  if (layers.length < 2) return;

  const shuffle = (items) => {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  const queue = [photos[0], ...shuffle(photos.slice(1))];
  let current = 0;
  let index = 0;

  layers[0].src = queue[0];
  layers[0].classList.add("is-active");

  if (queue.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const preload = new Image();
  preload.src = queue[1];

  window.setInterval(() => {
    const nextIndex = (index + 1) % queue.length;
    const nextLayer = layers[1 - current];
    nextLayer.src = queue[nextIndex];

    const swap = () => {
      nextLayer.classList.add("is-active");
      layers[current].classList.remove("is-active");
      current = 1 - current;
      index = nextIndex;
    };

    if (nextLayer.decode) {
      nextLayer.decode().then(swap).catch(swap);
    } else {
      nextLayer.onload = swap;
    }
  }, 7000);
})();

/* ---------------------------------------------------------- filia overlay */

(() => {
  const overlay = document.querySelector("[data-filia-overlay]");
  const trigger = document.querySelector("[data-filia-open]");
  if (!overlay || !trigger) return;

  const cover = overlay.querySelector(".secret-cover img");
  const closeButton = overlay.querySelector("[data-filia-close]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let closeTimer = 0;
  let readyTimer = 0;
  let fly = null;

  const removeFly = () => {
    if (fly) {
      fly.remove();
      fly = null;
    }
  };

  const markReady = () => {
    if (
      overlay.hidden ||
      overlay.classList.contains("is-closing") ||
      overlay.classList.contains("is-ready")
    ) {
      return;
    }

    window.clearTimeout(readyTimer);
    overlay.classList.add("is-ready");
    void overlay.offsetWidth;
    window.requestAnimationFrame(() => {
      if (!overlay.classList.contains("is-closing")) removeFly();
    });
    closeButton?.focus({ preventScroll: true });
  };

  const open = (event) => {
    event.preventDefault();
    window.clearTimeout(closeTimer);
    window.clearTimeout(readyTimer);
    removeFly();
    overlay.hidden = false;
    overlay.classList.remove("is-closing", "is-ready");
    document.body.classList.add("filia-open");

    if (!cover || reduceMotion.matches) {
      overlay.classList.add("is-open");
      markReady();
      return;
    }

    const start = trigger.getBoundingClientRect();
    const target = cover.getBoundingClientRect();
    overlay.classList.add("is-open");

    if (!start.width || !target.width) {
      markReady();
      return;
    }

    fly = document.createElement("img");
    fly.className = "filia-fly";
    fly.src = cover.getAttribute("src") || "";
    fly.alt = "";
    fly.draggable = false;
    Object.assign(fly.style, {
      left: `${start.left}px`,
      top: `${start.top}px`,
      width: `${start.width}px`,
      height: `${start.height}px`,
    });
    document.body.appendChild(fly);

    const scale = target.width / start.width;
    const dx = target.left - start.left;
    const dy = target.top - start.top;
    const animation = fly.animate(
      [
        { transform: "translate(0, 0) scale(1)" },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      ],
      {
        duration: 560,
        easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
        fill: "forwards",
      }
    );

    animation.addEventListener("finish", markReady);
    readyTimer = window.setTimeout(markReady, 640);
  };

  const close = () => {
    window.clearTimeout(readyTimer);
    removeFly();
    overlay.classList.remove("is-open", "is-ready");
    overlay.classList.add("is-closing");
    document.body.classList.remove("filia-open");
    closeTimer = window.setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove("is-closing");
    }, 380);
    trigger.focus({ preventScroll: true });
  };

  trigger.addEventListener("click", open);
  closeButton?.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", (event) => {
    if (!overlay.hidden && event.key === "Escape") close();
  });
})();


(() => {
  const gallery = document.querySelector("[data-gallery]");
  if (!gallery) return;

  const figures = [...gallery.querySelectorAll("figure[data-ratio]")];
  if (!figures.length) return;

  const items = figures.map((fig) => {
    const ratio = Number(fig.dataset.ratio);
    return { fig, ratio: Number.isFinite(ratio) && ratio > 0.2 ? Math.min(ratio, 6) : 1.5 };
  });

  let lastWidth = 0;

  const layout = () => {
    const width = gallery.getBoundingClientRect().width;
    if (!width || Math.abs(width - lastWidth) < 1) return;
    lastWidth = width;

    const style = getComputedStyle(gallery);
    const gap = Number.parseFloat(style.columnGap) || 14;
    const mobile = width < 600;
    const maxPerRow = mobile ? 2 : 4;
    const minHeight = 220;
    const maxHeight = mobile ? 380 : 440;
    const lastHeight = mobile ? maxHeight : 260;

    const rows = [];
    let row = [];
    let sum = 0;

    for (const item of items) {
      const count = row.length + 1;
      const candidate = (width - gap * (count - 1)) / (sum + item.ratio);

      if (row.length >= maxPerRow || (row.length > 0 && candidate < minHeight)) {
        rows.push({ items: row, sum });
        row = [];
        sum = 0;
      }

      row.push(item);
      sum += item.ratio;

      if (row.length === maxPerRow) {
        rows.push({ items: row, sum });
        row = [];
        sum = 0;
      }
    }

    if (row.length) rows.push({ items: row, sum });

    const heights = rows.map((currentRow) =>
      Math.min((width - gap * (currentRow.items.length - 1)) / currentRow.sum, maxHeight)
    );

    if (rows.length > 1) {
      const last = rows[rows.length - 1];
      const previous = rows[rows.length - 2];
      if (last.items.length < previous.items.length) {
        heights[heights.length - 1] = heights[heights.length - 2];
      }
    } else if (rows[0].items.length === 1) {
      heights[0] = Math.min(heights[0], lastHeight);
    }

    rows.forEach((currentRow, index) => {
      const height = heights[index];

      for (const item of currentRow.items) {
        item.fig.style.setProperty("--w", `${Math.floor(item.ratio * height * 100) / 100}px`);
        item.fig.style.setProperty("--h", `${Math.floor(height * 100) / 100}px`);
      }
    });

    gallery.classList.add("is-justified");
  };

  layout();

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      layout();
    });
  };

  if ("ResizeObserver" in window) {
    new ResizeObserver(schedule).observe(gallery);
  } else {
    window.addEventListener("resize", schedule);
  }
  window.addEventListener("load", schedule);
})();


/* ---------------------------------------------------------- theme toggle */
(() => {
  const buttons = [...document.querySelectorAll("[data-theme-toggle]")];
  if (!buttons.length) return;

  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  const readChoice = () => {
    try {
      const value = localStorage.getItem("theme");
      return value === "light" || value === "dark" ? value : null;
    } catch (error) {
      return null;
    }
  };

  const sync = () => {
    const dark = root.getAttribute("data-theme") === "dark";
    for (const button of buttons) {
      button.setAttribute("aria-pressed", dark ? "true" : "false");
      button.setAttribute("aria-label", dark ? "切换到浅色" : "切换到深色");
      button.setAttribute("title", dark ? "切换到浅色" : "切换到深色");
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (error) {
        /* 隐私模式下存不了，本次照样生效 */
      }
      sync();
    });
  }

  media.addEventListener?.("change", (event) => {
    if (readChoice()) return;
    root.setAttribute("data-theme", event.matches ? "dark" : "light");
    sync();
  });

  sync();
})();

/* ------------------------------------------------------ archive filter */
(() => {
  const bar = document.querySelector("[data-archive-tabs]");
  if (!bar) return;

  const tabs = [...bar.querySelectorAll("[data-archive-tab]")];
  const sections = [...document.querySelectorAll(".archive-year")];
  const months = [...document.querySelectorAll(".archive-month-block")];
  const items = [...document.querySelectorAll(".archive-card, .archive-text-item")];
  const countEl = document.querySelector("[data-archive-count]");

  const apply = (key) => {
    let visible = 0;
    for (const item of items) {
      const match = key === "*" || item.getAttribute("data-section") === key;
      item.hidden = !match;
      if (match) visible += 1;
    }
    for (const month of months) {
      month.hidden = !month.querySelector("[data-section]:not([hidden])");
    }
    for (const section of sections) {
      section.hidden = !section.querySelector("[data-section]:not([hidden])");
    }
    if (countEl) countEl.textContent = String(visible);
    for (const tab of tabs) {
      const on = tab.getAttribute("data-archive-tab") === key;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-pressed", on ? "true" : "false");
    }
    window.__layoutArchive?.();
  };

  bar.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-archive-tab]");
    if (tab) apply(tab.getAttribute("data-archive-tab"));
  });

  apply("*");
})();

/* ---------------------------------------------------- archive masonry */

(() => {
  const grids = [...document.querySelectorAll(".archive-grid")];
  if (!grids.length) return;

  let frame = 0;

  const layout = () => {
    frame = 0;
    const gap = 18;
    const rowGap = 22;

    for (const grid of grids) {
      const cards = [...grid.querySelectorAll(".archive-card:not([hidden])")];
      if (!cards.length) {
        grid.style.height = "0px";
        continue;
      }

      const width = grid.getBoundingClientRect().width;
      const columns = width > 900 ? 3 : width > 560 ? 2 : 1;
      const cardWidth = (width - gap * (columns - 1)) / columns;
      const heights = new Array(columns).fill(0);
      grid.classList.add("is-masonry");

      for (const card of cards) {
        card.style.width = `${cardWidth}px`;
        card.style.left = "0px";
        card.style.top = "0px";
        const height = card.getBoundingClientRect().height;
        const column = heights.indexOf(Math.min(...heights));
        card.style.left = `${column * (cardWidth + gap)}px`;
        card.style.top = `${heights[column]}px`;
        heights[column] += height + rowGap;
      }

      grid.style.height = `${Math.max(...heights)}px`;
    }
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(layout);
  };

  window.__layoutArchive = schedule;
  schedule();
  window.addEventListener("load", schedule);
  window.addEventListener("resize", schedule);
})();

/* ---------------------------------------------------------- page transition */

(() => {
  const fade = document.querySelector(".page-fade");
  if (!fade) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let navigating = false;

  const reset = () => {
    navigating = false;
    document.body.classList.remove("is-leaving");
    document.body.style.pointerEvents = "";
  };

  window.addEventListener("pageshow", reset);

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (reduceMotion.matches) return;

    const link = event.target.closest?.("a");
    if (!link || link.target || link.hasAttribute("download")) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return;

    let url;
    try {
      url = new URL(link.href, location.href);
    } catch {
      return;
    }

    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    if (/\.(?:xml|jpg|jpeg|png|webp|gif|svg|pdf|zip|mp3|mp4)$/i.test(url.pathname)) return;

    event.preventDefault();
    if (navigating) return;

    navigating = true;
    document.body.classList.add("is-leaving");
    document.body.style.pointerEvents = "none";

    window.setTimeout(() => {
      location.href = url.href;
    }, 160);
  });
})();

