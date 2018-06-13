(function () {
  class BasicRenderer {
    constructor(reader) {
      this.reader = reader
      this.initialize()
      this.renderedPages = 0
    }

    get container() { return this.reader.container }
    get imageContainer() { return this.reader.imageContainer }

    initialize() {
      this.imageContainer.innerHTML = ''
    }

    destroy() {
      this.imageContainer.innerHTML = ''
    }

    render() {}
  }

  class Alert extends BasicRenderer {
    get name () { return 'alert' }

    render(data) {
      this.imageContainer.innerHTML = `<div class='alert alert-${data.type} text-center' role='alert'>${data.msg}</div>`
    }
  }

  class Recommendations extends BasicRenderer {
    get name () { return 'recommendations' }

    initialize() {
      super.initialize()
      this.recContainer = this.container.querySelector('.reader-recommendations')
      this.recContainer.innerHTML = ''
      this.recContainer.style.display = null
      this.imageContainer.style.display = 'none'
      this.container.querySelector('.reader-page-bar').style.display = 'none'
    }
    destroy() {
      super.destroy()
      this.recContainer.innerHTML = ''
      this.recContainer.style.display = 'none'
      this.imageContainer.style.display = null
      this.container.querySelector('.reader-page-bar').style.display = null
    }

    render(recs) {
      const recStr = recs.reduce((acc, rec) => {
        const ch = rec.chapters[rec.chapters.length-1]
        const more = rec.chapters.length >= 2 ? ` <em>(+${rec.chapters.length-1} more)</em>` : ''
        // FIXME: htmlentities hack
        return acc+`<a href="/chapter/${ch.id}" class="rec-item col-md-3 col-xs-6" data-chapter="${ch.id}">
          <img src="https://s1.mangadex.org/images/manga/${rec.id}.thumb.jpg"></img>
          <p><strong>${$('<textarea/>').html(rec.title).text()}</strong></p>
          <p>${this.getChapterTitle(ch) + more}</p>
        </a>`
      }, '')
      this.recContainer.innerHTML = `<h2>Recommendations</h2><h3>Unread Follows</h3><div class="row">${recStr}</div>`
      const handler = (evt) => {
        evt.preventDefault()
        evt.stopPropagation()
        const chapter = evt.target.dataset.chapter || evt.currentTarget.dataset.chapter
        if (chapter) {
          this.reader.moveToChapter(parseInt(chapter))
          this.reader.setRenderer(this.reader.settings.renderingMode)
        }
      }
      this.recContainer.querySelectorAll('a').forEach(c => c.addEventListener('click', handler, true))
      return Promise.resolve()
    }

    getChapterTitle(ch, numOnly) {
      let title = ''
      if (ch.volume) title += `Vol. ${ch.volume} `
      if (ch.chapter) title += `Ch. ${ch.chapter} `
      if (ch.title && !numOnly) title += `${ch.title}`
      if (!title) title = 'Oneshot'
      return title.trim()
    }
  }

  class SinglePage extends BasicRenderer {
    get name () { return 'single-page' }

    render(pg) {
      return this.reader.getPage(pg).then(page => {
        if (page) {
          const curImage = this.imageContainer.querySelector('img') || this.imageContainer.appendChild(document.createElement('img'))
          curImage.src = page.image.src
          curImage.dataset.page = page.page
          this.renderedPages = 1
        }
        return Promise.resolve()
      })
    }
  }

  class DoublePage extends BasicRenderer {
    get name () { return 'double-page' }

    get isPageTurnForwards() { return this.reader.previousPage < this.reader.currentPage }
    get isSinglePageBackwards() { return this.reader.previousPage === this.reader.currentPage + 1 }

    render(pg) {
      const pageNumbers = [pg, pg+1]
      return Promise.all(pageNumbers.map(page => this.reader.getPage(page)))
        .then(pages => pages.filter(p => p))
        .then(newPages => {
          if (newPages.length > 1 && newPages.some(pg => pg.image.width > pg.image.height && pg.image.width > this.imageContainer.offsetWidth/2)) {
            if (this.isPageTurnForwards || this.isSinglePageBackwards) {
              newPages.pop()
            } else {
              newPages.shift()
              this.reader.currentPage = pg + 1
            }
          }
          const curImages = Array.from(this.imageContainer.querySelectorAll('img'))
          curImages.slice(newPages.length).forEach(img => this.imageContainer.removeChild(img))
          for (let [i, page] of newPages.entries()) {
            if (!curImages[i]) {
              curImages[i] = this.imageContainer.appendChild(document.createElement('img'))
            }
            curImages[i].src = page.image.src
            curImages[i].dataset.page = page.page
          }
          this.renderedPages = newPages.length
          return Promise.resolve()
        })
    }
  }

  class LongStrip extends BasicRenderer {
    get name () { return 'long-strip' }

    render() {
      if (this.reader.currentPage === 0) {
        this.reader.currentPage = 1
      }
      const canRenderNext = () => {
        return (this.renderedPages < this.reader.currentPage) && (window.scrollY > this.imageContainer.offsetHeight - window.innerHeight*2)
      }
      if (canRenderNext()) {
        return this.reader.getPage(this.reader.currentPage, true).then(page => {
          if (page.page === this.reader.currentPage) {
            this.imageContainer.appendChild(page.image)
            this.renderedPages = page.page
            if (this.reader.currentPage === this.reader.chapter.totalPages) {
              this.removeScrollHandler()
            } else {
              this.reader.render(this.reader.currentPage + 1)
            }
          }
        })
      }
      return Promise.resolve()
    }

    initialize() {
      super.initialize()
      this.reader.currentPage = 0
      this.addScrollHandler()
    }

    destroy() {
      super.destroy()
      this.removeScrollHandler()
    }

    addScrollHandler() {
      this.scrollHandler = () => { this.render() }
      window.addEventListener('scroll', this.scrollHandler)
    }
    removeScrollHandler() {
      window.removeEventListener('scroll', this.scrollHandler)
    }
  }

  const Renderer = { Alert, Recommendations, SinglePage, DoublePage, LongStrip }

  if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = Renderer
  } else if (typeof define === 'function' && define.amd) {
    define([], function () {
      return Renderer
    })
  } else if (typeof exports === 'object') {
    exports.Renderer = Renderer
  } else {
    (typeof window !== 'undefined' ? window : this).Renderer = Renderer
  }

})();