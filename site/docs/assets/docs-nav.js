(() => {
  const nav = document.getElementById("sidebar")
  if (!nav) return

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
        { text: "Demo", link: "../demo/" },
        { text: "GitHub", link: "https://github.com/noy4/his", external: true },
      ],
    },
  ]

  const title = document.createElement("div")
  title.className = "side-title"
  title.textContent = "Docs"
  nav.append(title)

  for (const group of sidebar) {
    const head = document.createElement("div")
    head.className = "side-group"
    head.textContent = group.text
    nav.append(head)

    for (const item of group.items) {
      const a = document.createElement("a")
      a.href = item.link
      a.textContent = item.text
      if (item.external) {
        a.target = "_blank"
        a.rel = "noopener"
      }
      nav.append(a)
    }
  }

  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase()
  for (const a of nav.querySelectorAll("a")) {
    const name = (a.getAttribute("href") ?? "").split("/").pop().toLowerCase()
    if (name === page) a.classList.add("active")
  }
})()
