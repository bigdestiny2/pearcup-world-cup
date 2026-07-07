// Virtual list helper — render large tables/lists without jank.
//
// Usage:
//   const list = VirtualList({ container: '#serverTable tbody', rowHeight: 52, total: 200 })
//   list.render(index => `<tr>…</tr>`)
//
// The helper creates a tall spacer so scrollbars reflect the full dataset, then
// only renders the rows that fall inside the viewport plus an overscan buffer.
(function attachVirtualList (root) {
  'use strict'

  function create (opts) {
    const container = typeof opts.container === 'string'
      ? root.document && root.document.querySelector(opts.container)
      : opts.container
    if (!container) return null

    const rowHeight = opts.rowHeight || 48
    const overscan = opts.overscan || 6
    const total = opts.total || 0
    const renderRow = opts.renderRow || (() => '')

    const wrapper = root.document.createElement('div')
    wrapper.className = 'virtual-list-wrapper'
    wrapper.style.position = 'relative'
    wrapper.style.width = '100%'

    const content = root.document.createElement('div')
    content.className = 'virtual-list-content'
    content.style.position = 'absolute'
    content.style.left = '0'
    content.style.right = '0'
    content.style.top = '0'

    const spacer = root.document.createElement('div')
    spacer.className = 'virtual-list-spacer'
    spacer.style.height = `${Math.max(0, total * rowHeight)}px`

    // Preserve container children structure by wrapping inner HTML once.
    if (!container.dataset.virtualWrapped) {
      container.dataset.virtualWrapped = '1'
      while (container.firstChild) wrapper.appendChild(container.firstChild)
    }
    wrapper.appendChild(spacer)
    wrapper.appendChild(content)
    container.innerHTML = ''
    container.appendChild(wrapper)

    function update (newTotal) {
      const t = newTotal != null ? newTotal : total
      spacer.style.height = `${Math.max(0, t * rowHeight)}px`
      render()
    }

    function render () {
      if (!container.isConnected) return
      const scrollTop = container.scrollTop || 0
      const viewportHeight = container.clientHeight || 400
      const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
      const end = Math.min(total - 1, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan)
      const offsetTop = start * rowHeight

      let html = ''
      for (let i = start; i <= end; i++) {
        html += renderRow(i)
      }
      content.style.transform = `translateY(${offsetTop}px)`
      content.innerHTML = html
    }

    container.addEventListener('scroll', render, { passive: true })
    root.addEventListener && root.addEventListener('resize', render)

    render()

    return {
      update,
      refresh: render,
      destroy () {
        container.removeEventListener('scroll', render)
        root.removeEventListener && root.removeEventListener('resize', render)
        container.innerHTML = wrapper.innerHTML
      }
    }
  }

  const api = { create }
  root.VirtualList = api
  if (typeof module !== 'undefined' && module.exports) module.exports = api
})(typeof globalThis !== 'undefined' ? globalThis : window)
