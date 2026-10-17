(() => {
  const nav = document.getElementById("toc")
  if (!nav) return

  const toc = {
    scope: ".container",
    selector: "h2, h3",
    title: "On this page",
    offset: 96,
  }

  nav.append(el("div", { class: "toc-title", text: toc.title }))

  const headings = [...document.querySelectorAll(`${toc.scope} ${toc.selector}`)]
  const seen = {}
  for (const h of headings) {
    const text = h.textContent.trim()
    if (!h.id) {
      const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      seen[base] = (seen[base] ?? 0) + 1
      h.id = seen[base] > 1 ? `${base}-${seen[base]}` : base
    }
    const a = el("a", { href: `#${h.id}`, class: h.tagName === "H3" ? "toc-h3" : null })
    a.innerHTML = h.innerHTML
    a.querySelector("iconify-icon")?.removeAttribute("width")
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      e.preventDefault()
      h.scrollIntoView({ behavior: "smooth" })
      history.replaceState(null, "", `#${h.id}`)
    })
    nav.append(a)
  }

  const links = new Map([...nav.querySelectorAll("a")].map((a) => [a.getAttribute("href").slice(1), a]))
  const update = () => {
    let current = headings[0]
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= toc.offset) current = h
    }
    for (const a of links.values()) a.classList.remove("active")
    links.get(current.id)?.classList.add("active")
  }
  addEventListener("scroll", update, { passive: true })
  update()

  // ---

  // https://github.com/cloudflare/cloudflare-os/blob/main/packages/bundled-blueprints/libraries/ui/src/dom.ts
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag)
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue
      if (key === "class") node.className = value
      else if (key === "text") node.textContent = value
      else if (key === "html") node.innerHTML = value
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value)
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value)
      else node.setAttribute(key, value === true ? "" : String(value))
    }
    for (const child of Array.isArray(children) ? children : [children]) {
      if (child == null || child === false) continue
      node.append(child)
    }
    return node
  }
})()
