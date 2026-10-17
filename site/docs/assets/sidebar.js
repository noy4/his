(() => {
  const nav = document.getElementById("sidebar")
  if (!nav) return

  const brand = {
    icon: "mdi:history",
    title: "his",
  }

  const sidebar = [
    {
      text: "Specs",
      items: [
        { text: "Spec", link: "SPEC.html" },
        { text: "Database", link: "SPEC.db.html" },
        { text: "RPC", link: "SPEC.rpc.html" },
      ],
    },
    {
      text: "Plans",
      items: [
        { text: "Plan", link: "PLAN.html" },
        { text: "WebUI", link: "PLAN.web.html" },
        { text: "GitHub Insights", link: "PLAN.github.html" },
        { text: "Hide patterns", link: "PLAN.hide.html" },
      ],
    },
    {
      text: "Site",
      items: [
        { text: "Home", link: "../" },
        { text: "Demo", link: "../demo/", external: true },
        { text: "GitHub", link: "https://github.com/noy4/his", external: true },
      ],
    },
  ]

  const content = el("div", { class: "sidebar-content" })
  nav.append(content)

  const menu = el("div", { class: "sidebar-menu" })
  content.append(
    el("a", { class: "sidebar-brand", href: "../" }, [
      el("iconify-icon", { icon: brand.icon, width: "24", noobserver: true }),
      el("span", { text: brand.title }),
    ]),
    menu,
  )

  for (const group of sidebar) {
    menu.append(
      el("div", { class: "sidebar-heading", text: group.text }),
      el(
        "ul",
        {},
        group.items.map((item) =>
          el("li", {}, [
            el("a", {
              href: item.link,
              text: item.external ? `${item.text} ↗` : item.text,
              target: item.external ? "_blank" : null,
              rel: item.external ? "noopener" : null,
            }),
          ]),
        ),
      ),
    )
  }

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase()
  for (const a of nav.querySelectorAll("a")) {
    const name = (a.getAttribute("href") ?? "").split("/").pop().toLowerCase()
    if (name === page) a.classList.add("active")
  }

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
