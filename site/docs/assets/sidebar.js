(() => {
  const nav = document.getElementById("sidebar")
  if (!nav) return

  const config = {
    icon: "mdi:history",
    title: "his",
  }

  const sidebar = [
    {
      text: "Specs",
      items: [
        { text: "Spec", link: "SPEC.html", icon: "mdi:file-document-edit-outline" },
        { text: "Database", link: "db.html", icon: "mdi:database-outline" },
        { text: "RPC", link: "rpc.html", icon: "mdi:swap-horizontal" },
      ],
    },
    {
      text: "Plans",
      items: [
        { text: "Plan", link: "PLAN.html", icon: "mdi:clipboard-list-outline" },
        { text: "WebUI", link: "PLAN.web.html", icon: "mdi:application-brackets-outline" },
        { text: "GitHub Insights", link: "PLAN.github.html", icon: "mdi:github" },
        { text: "Hide patterns", link: "PLAN.hide.html", icon: "mdi:eye-off-outline" },
      ],
    },
    {
      text: "Archive",
      items: [
        { text: "Favicon DB", link: "archive/favicon-db.html", icon: "mdi:image-multiple-outline" },
        { text: "Notifications", link: "archive/notifications.html", icon: "mdi:bell-outline" },
      ],
    },
    {
      text: "Site",
      items: [
        { text: "Home", link: "../", icon: "mdi:home-outline" },
        { text: "Demo", link: "../demo/", icon: "mdi:monitor-dashboard", external: true },
        { text: "GitHub", link: "https://github.com/noy4/his", icon: "mdi:github", external: true },
      ],
    },
  ]

  const content = el("div", { class: "sidebar-content" })
  nav.append(content)

  const brand = el("a", { class: "sidebar-brand", href: "../" }, [
    el("iconify-icon", { icon: config.icon, width: "24" }),
    el("span", { text: config.title }),
  ])
  const menu = el("div", { class: "sidebar-menu" })
  content.append(brand, menu)

  for (const group of sidebar) {
    menu.append(
      el("div", { class: "sidebar-heading", text: group.text }),
      el("ul", {}, group.items.map((item) => el("li", {}, [link(item)]))),
    )
  }

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase()
  for (const a of nav.querySelectorAll("a")) {
    const name = (a.getAttribute("href") ?? "").split("/").pop().toLowerCase()
    if (name === page) a.classList.add("active")
  }

  // ---

  function link(item) {
    return el(
      "a",
      {
        href: item.link,
        target: item.external ? "_blank" : null,
        rel: item.external ? "noopener" : null,
      },
      [
        item.icon
          ? el("iconify-icon", { icon: item.icon, width: "16" })
          : null,
        el("span", { text: item.external ? `${item.text} ↗` : item.text }),
      ],
    )
  }

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
