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
        { text: "Settings", link: "settings.html", icon: "mdi:cog-outline" },
      ],
    },
    {
      text: "Plans",
      items: [
        { text: "Plan", link: "PLAN.html", icon: "mdi:clipboard-list-outline" },
        { text: "WebUI", link: "PLAN.web.html", icon: "mdi:application-brackets-outline" },
      ],
    },
    {
      text: "Archive",
      collapsed: true,
      items: [
        { text: "Favicon DB", link: "archive/favicon-db.html", icon: "mdi:image-multiple-outline" },
        { text: "Notifications", link: "archive/notifications.html", icon: "mdi:bell-outline" },
      ],
    },
    {
      text: "Links",
      items: [
        { text: "Website", link: "../", icon: "mdi:web" },
        { text: "Demo", link: "../demo/", icon: "mdi:monitor-dashboard", external: true },
        { text: "GitHub", link: "https://github.com/noy4/his", icon: "mdi:github", external: true },
      ],
    },
  ]

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase()

  const content = el("div", { class: "sidebar-content" })
  nav.append(content)

  // resolve brand href
  const script = document.currentScript
  const docsRoot = script ? new URL("../", script.src) : new URL(".", location.href)
  const brandHref = new URL("index.html", docsRoot).href

  const brand = el("a", { class: "sidebar-brand", href: brandHref }, [
    el("iconify-icon", { icon: config.icon, width: "24" }),
    el("span", { text: config.title }),
  ])
  const menu = el("div", { class: "sidebar-menu" })
  content.append(brand, menu)

  sidebar.forEach((group, index) => {
    const id = `sidebar-group-${index}`
    const collapsible = group.collapsed != null
    const list = el("ul", { id }, group.items.map((item) => el("li", {}, [link(item)])))
    const heading = el(
      collapsible ? "button" : "div",
      {
        class: "sidebar-heading",
        type: collapsible ? "button" : null,
        "aria-controls": collapsible ? id : null,
      },
      [
        el("span", { text: group.text }),
        collapsible
          ? el("iconify-icon", { class: "sidebar-caret", icon: "mdi:chevron-right", width: "16" })
          : null,
      ],
    )
    menu.append(el("div", { class: "sidebar-group" }, [heading, list]))

    if (!collapsible) return

    let expanded = false
    const setExpanded = (value) => {
      expanded = value
      list.hidden = !expanded
      heading.setAttribute("aria-expanded", String(expanded))
      heading.classList.toggle("expanded", expanded)
    }

    setExpanded(!group.collapsed || list.querySelector("a.active") != null)
    heading.addEventListener("click", () => setExpanded(!expanded))
  })

  // ---

  function link(item) {
    const active = (item.link.split("/").pop() ?? "").toLowerCase() === page
    return el(
      "a",
      {
        href: item.link,
        class: active ? "active" : null,
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
