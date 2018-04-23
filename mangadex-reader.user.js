// ==UserScript==
// @name         MangaDex Reader
// @namespace    Teasday
// @version      0.1
// @license      GNU GPLv3
// @description  ｷﾀ━━━━━━(ﾟ∀ﾟ)━━━━━━ !!!!!
// @author       Teasday
// @match        https://mangadex.org/chapter/*
// @icon         https://mangadex.org/favicon.ico
// @run-at       document-end
// @grant        none
// ==/UserScript==

/* jshint asi: true */
(function() {
  'use strict'

  class Reader {
    constructor() {
      this.data = this.parseData()
      console.log(this.data)
      this.container = this.initializeContainer()
      this.imageContainer = this.container.querySelector('.reader-images')
      this.imageCache = {}
      this.preloadPageAmount = 3
      this.renderedPages = 0
      this.currentPage = null
      this.setLoading(false)
      this.setDisplayFit(parseInt(localStorage.getItem('reader.displayFit')) || undefined)
      this.setDirection(parseInt(localStorage.getItem('reader.direction')) || undefined)
      this.setRenderingMode(parseInt(localStorage.getItem('reader.renderingMode')) || undefined, true)
      this.registerEvents()
      const path = document.querySelector('meta[property="og:url"]').content.split('/')
      let page = path.length === 6 ? parseInt(path[5]) || 1 : 1
      if (page === -1) {
        page = this.totalPages
      }
      this.moveToPage(page, true)
      window.history.replaceState({ page: this.currentPage }, null, this.pageURL(this.data.chapter_id, this.currentPage))
    }

    parseData() {
      try {
        return JSON.parse(document.querySelector('script[data-type="chapter"]').innerHTML)
      } catch (err) {
        console.error(err)
      }
    }

    initializeContainer() {
      const style = document.createElement('style')
      style.innerHTML = `
        .reader {
          display: flex;
          flex-direction: column;
          margin-top: -20px; /* counteract default header and footer margins */
          margin-bottom: -30px;
        }
        .reader-controls-wrapper {
          flex: 0 1 20%;
          display: flex;
          flex-flow: row;
          justify-content: flex-end;
          order: 1;
        }
        .reader-controls {
          display: flex;
          flex: 1 0 auto;
          width: calc(100% - 40px);
          flex-flow: column;
          border-left: 1px solid rgba(128, 128, 128, 0.5);
          overflow: hidden;
        }
        .reader-controls-row {
          display: flex;
          align-items: center;
          padding: 0.5em;
        }
        .reader-controls
        .reader-controls-row + .reader-controls-row {
          border-top: 1px solid rgba(128, 128, 128, 0.5);
        }
        .reader-controls .list-unstyled  {
          margin-bottom: 0;
        }
        .reader-controls-collapser {
          flex: 0 1 30px;
          max-width: 30px;
          display: none;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .reader-controls-collapser:hover {
          background: rgba(128, 128, 128, 0.1);
        }
        .reader-controls-wrapper.collapsed {
          flex: 0 1 30px;
          min-width: 0;
        }
        .reader-controls-wrapper.collapsed .reader-controls {
          width: 0;
          white-space: nowrap;
        }

        .reader-images,
        .reader-images img,
        .reader-controls-pages,
        .reader-page-bar,
        .reader-page-bar .thumb {
          transition-property: all;
          transition-duration: .2s;
        }

        .reader-controls-wrapper,
        .reader-controls,
        .reader-controls-row {
          transition-property: flex, min-width, min-height, padding;
          transition-duration: .4s;
        }

        .reader-main {
          flex: 1 0 auto;
          display: flex;
          flex-flow: column;
          order: 2;
        }
        .reader-images {
          flex: 1 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .reader.fit-height .reader-images,
        .reader.no-resize .reader-images {
          display: block;
        }
        .reader-page-bar {
          max-height: 35px;
          min-height: 35px;
        }
        .reader.fit-height .reader-images,
        .reader.fit-both .reader-images {
          height: calc(100vh - 50px - 35px);
        }
        .reader.hide-page-bar .reader-page-bar,
        .reader.long-strip .reader-page-bar,
        .reader.long-strip .reader-controls-pages {
          max-height: 0;
          min-height: 0;
          overflow: hidden;
          padding: 0;
        }
        .reader.hide-page-bar.fit-height .reader-images {
          height: calc(100vh - 50px);
        }
        .reader.fit-height .reader-images img {
          height: 100%;
          max-width: none;
        }
        .reader.fit-both .reader-images img  {
          max-height: 100%;
        }
        .reader.fit-width .reader-images img,
        .reader.fit-both .reader-images img {
          max-width: 100%;
        }
        .reader.double-page. .reader-images img {
          max-width: 50%;
        }
        .reader.no-resize .reader-images img {
          height: auto;
          width: auto;
          max-height: none;
          max-width: none;
        }
        .reader.double-page.direction-ltr .reader-images {
          display: flex;
          flex-direction: row;
        }
        .reader.double-page.direction-rtl .reader-images {
          display: flex;
          flex-direction: row-reverse;
        }
        .reader.single-page .reader-images,
        .reader.double-page .reader-images {
          cursor: pointer;
        }
        .reader.long-strip .reader-images {
          display: flex;
          flex-direction: column;
        }
        .reader.long-strip.fit-both .reader-images,
        .reader.long-strip.fit-height .reader-images {
          height: auto;
        }
        .reader.long-strip.fit-both .reader-images img,
        .reader.long-strip.fit-height .reader-images img {
          height: auto;
          max-height: calc(100vh - 50px);
        }

        .reader-page-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 40px;
          border-top: 1px solid rgba(128, 128, 128, 0.5);
        }
        .reader-page-bar .track {
          background: #444;
          border: 1px solid #aaa;
          border-radius: 15px;
          height: 15px;
          width: 100%;
          margin: 0 10px;
          cursor: pointer;
        }
        .reader-page-bar .thumb {
          height: 100%;
          background: #ddd;
          border-radius: 5px;
          float: left;
          width: 0%;
          min-width: 15px;
        }

        .reader-load-icon {
          position: absolute;
          left: calc(50% - 50px);
          top: calc(50% - 50px);
          font-size: 100px;
          color: white;
          text-shadow: 0 0 7px rgba(0,0,0,0.5);
          transition: opacity 0.5s ease-in;
          opacity: 0;
          display: none;
        }
        .reader-images img,
        .reader.is-loading .reader-load-icon {
          opacity: 1;
        }
        .reader.is-loading .reader-images img {
          opacity: 0;
        }

        .reader-controls-mode,
        .reader-controls-mode span:not(.fas) {
          display: none
        }
        .reader.no-resize .reader-controls-mode .no-resize,
        .reader.fit-both .reader-controls-mode .fit-both,
        .reader.fit-height .reader-controls-mode .fit-height,
        .reader.fit-width .reader-controls-mode .fit-width,
        .reader.direction-ltr .reader-controls-mode .direction-ltr,
        .reader.direction-rtl .reader-controls-mode .direction-rtl,
        .reader.single-page .reader-controls-mode .single-page,
        .reader.double-page .reader-controls-mode .double-page,
        .reader.long-strip .reader-controls-mode .long-strip {
          display: inline;
        }

        @media (min-width: 992px) {
          body {
            margin-bottom: 0;
          }
          .reader {
            flex-direction: row;
            min-height: calc(100vh - 50px);
          }
          .reader-controls-wrapper {
            position: sticky;
            min-width: 20%;
            top: 50px;
            z-index: 1;
            order: 2;
            height: calc(100vh - 50px);
            border-left: 1px solid rgba(128, 128, 128, 0.5);
          }
          .reader-controls-mode,
          .reader-controls-collapser {
            display: flex;
          }
          .reader-main {
            flex: 1 0 80%;
            order: 1;
            min-height: auto;
          }
          .reader-page-bar {
            margin-bottom: 0;
          }
        }
        `
      document.head.appendChild(style)

      document.body.style.removeProperty('margin-bottom')
      const jumpChapter = document.querySelector('#jump_chapter').parentElement.innerHTML
      const container = document.querySelector('div[role=main]')
      const footer = document.querySelector('footer p').innerHTML
      document.querySelector('footer').classList.add('hidden-lg', 'hidden-md')
      container.classList.replace('container', 'reader')
      container.innerHTML = `
      <div class="reader-main">
        <div class="reader-images"></div>
        <div class="reader-page-bar">
          <div class="track"><div class="thumb"></div></div>
        </div>
        <div aria-hidden="true" title="" class="fas fa-circle-notch fa-spin reader-load-icon"></div>
      </div>
      <div class="reader-controls-wrapper">
        <div class="reader-controls-collapser">
          <span class="fas fa-caret-right fa-fw" aria-hidden="true" title="Collapse menu" style="font-size:30px;"></span>
        </div>
        <div class="reader-controls">
          <div class="reader-controls-row reader-controls-title" style="flex-flow:column">
            <div style="font-size:1.25em; text-align:center">
              <img style="display:inline-block; border-radius:5px;" src="https://s1.mangadex.org/images/flags/${this.data.flag_url}.png" alt="${this.data.lang}" title="${this.data.lang}">
              <!--<span class="fas fa-book fa-fw" aria-hidden="true" title=""></span>-->
              <a title="${this.data.manga_title}" href="${this.data.manga_url}">${this.data.manga_title}</a>
            </div>
            <div style="font-size:1em; text-align:center;">
              ${this.data.chapter_title}
            </div>
          </div>
          <div class="reader-controls-row reader-controls-chapters">
            <a class="chapter-link-left" style="font-size:30px" href="${this.pageURL(this.data.prev_chapter_id)}">
              <span class="fas fa-angle-left fa-fw" aria-hidden="true" title="Skip a chapter to the left"></span>
            </a>
            <div style="flex:1 0 auto;width:0;">
              ${jumpChapter}
            </div>
            <a class="chapter-link-right" style="font-size:30px" href="${this.pageURL(this.data.next_chapter_id)}">
              <span class="fas fa-angle-right fa-fw" aria-hidden="true" title="Skip a chapter to the right"></span>
            </a>
          </div>
          <div class="reader-controls-row reader-controls-groups">
            <ul class="list-unstyled">
              ${Object.entries(this.data.other_groups).reduce((a, [id, g]) => a+`
                <li>
                  <img style='display:inline-block; border-radius:5px;' src='https://s1.mangadex.org/images/flags/${g.lang_flag}.png' alt='${g.lang_name}' title='${g.lang_name}' />
                  ${id == this.data.chapter_id ? '<b>' : ''}
                    <a href="/chapter/${id}">
                      ${[g.group_name, g.group_name_2, g.group_name_3].filter(n => n).join(' | ')}
                    </a>
                  ${id == this.data.chapter_id ? '</b>' : ''}
                </li>`, '')}
            </ul>
          </div>
          <div class="reader-controls-row reader-controls-actions">
            <button title="Comment" class="btn btn-default comment_button" style="flex:1 0 auto">
              <span class="far fa-comments fa-fw" aria-hidden="true" title=""></span>
            </button>
            <button title="Reader settings" class="btn btn-default" id="settings_button" style="flex:1 0 auto">
              <span class="fas fa-cog fa-fw" aria-hidden="true" title=""></span>
            </button>
            <button title="Reader settings" class="btn btn-default" id="settings_button" style="flex:1 0 auto">
              <span class="fas fa-expand fa-fw" aria-hidden="true" title=""></span>
            </button>
            <button title="Report" class="btn btn-default" id="report_button" style="flex:1 0 auto">
              <span class="fas fa-flag fa-fw" aria-hidden="true" title=""></span>
            </button>
          </div>
          <div class="reader-controls-row reader-controls-mode" style="flex-flow:column; align-items:flex-start;">
            <div><key style="font-family:monospace">^f</key> <span class="fas fa-expand fa-fw" aria-hidden="true" title="Display fit"></span> <span class="no-resize">No resize</span><span class="fit-both">Fit to container</span><span class="fit-height">Fit height</span><span class="fit-width">Fit width</span></div>
            <div><key style="font-family:monospace">&nbsp;g</key> <span class="fas fa-book fa-fw" aria-hidden="true" title="Reader mode"></span> <span class="single-page">Single page</span><span class="double-page">Double page</span><span class="long-strip">Long strip</span></div>
            <div><key style="font-family:monospace">&nbsp;h</key> <span class="fas fa-exchange-alt fa-fw" aria-hidden="true" title="Direction"></span> <span class="direction-ltr">Left to right</span><span class="direction-rtl">Right to left</span></div>
          </div>
          <div class="reader-controls-row" style="flex:1 0 auto"></div>
          <div class="reader-controls-row reader-controls-footer hidden-sm hidden-xs">
            <div class="text-center text-muted" style="flex:1 0 auto;">
              © 2018 <a href="/">MangaDex</a> - <a href="https://hologfx.com" target="_blank" title="Project AniDex Portal">Project AniDex</a>
            </div>
          </div>
          <div class="reader-controls-row reader-controls-pages hidden-sm hidden-xs">
            <a class="page-link-left" style="font-size:30px" href="">
              <span class="fas fa-angle-left fa-fw" aria-hidden="true" title="Turn page left"></span>
            </a>
            <div style="flex:1 0 auto; text-align:center;">
              Page <span class="current-page">0</span> / <span class="total-pages">0</span>
            </div>
            <a class="page-link-right" style="font-size:30px" href="">
              <span class="fas fa-angle-right fa-fw" aria-hidden="true" title="Turn page right"></span>
            </a>
          </div>
        </div>
      </div>
      `
      return container
    }

    get totalPages() { return this.data.page_array.length }

    get isSinglePage()   { return this.renderingMode === Reader.RENDERING_MODE.SINGLE }
    get isDoublePage()   { return this.renderingMode === Reader.RENDERING_MODE.DOUBLE }
    get isLongStrip()    { return this.renderingMode === Reader.RENDERING_MODE.LONG }
    get isNoResize()     { return this.displayFit === Reader.DISPLAY_FIT.NO_RESIZE }
    get isFitHeight()    { return this.displayFit === Reader.DISPLAY_FIT.FIT_HEIGHT }
    get isFitWidth()     { return this.displayFit === Reader.DISPLAY_FIT.FIT_WIDTH }
    get isFitBoth()      { return this.displayFit === Reader.DISPLAY_FIT.FIT_BOTH }
    get isDirectionLTR() { return this.direction === Reader.DIRECTION.LTR }
    get isDirectionRTL() { return this.direction === Reader.DIRECTION.RTL }

    get isPageTurnForwards() { return this.previousPage < this.currentPage }

    pageURL(id, pg) {
      if (id != null && id != 0) {
        if (pg != null) {
          if (pg === 0) {
            return this.pageURL(this.data.prev_chapter_id, -1)
            // return this.pageURL(this.data.prev_chapter_id, this.data.prev_pages)
          } else if (pg > this.totalPages) {
            return this.pageURL(this.data.next_chapter_id)
          }
          return `/chapter/${id}/${pg}`
        }
        return `/chapter/${id}`
      }
      return this.data.manga_url
    }
    pageLeftURL(pages = this.isDoublePage ? 2 : 1) {
      return this.pageURL(this.data.chapter_id, Math.min(this.currentPage + (this.isDirectionLTR ? -pages : pages)), 0)
    }
    pageRightURL(pages = this.isDoublePage ? 2 : 1) {
      return this.pageURL(this.data.chapter_id, Math.min(this.currentPage + (this.isDirectionLTR ? pages : -pages)), 0)
    }

    imageURL(pg) {
      return this.data.server + this.data.dataurl + '/' + this.data.page_array[pg - 1]
    }

    setDirection(direction = Reader.DIRECTION.LTR) {
      if (direction !== this.direction) {
        this.direction = direction
        this.container.classList.toggle('direction-ltr', this.isDirectionLTR)
        this.container.classList.toggle('direction-rtl', this.isDirectionRTL)
        const prevUrl = this.pageURL(this.data.prev_chapter_id)
        const nextUrl = this.pageURL(this.data.next_chapter_id)
        Array.from(this.container.querySelectorAll('a.chapter-link-right')).forEach(a => { a.href = (this.isDirectionLTR) ? nextUrl : prevUrl })
        Array.from(this.container.querySelectorAll('a.chapter-link-left')).forEach(a => { a.href = (this.isDirectionRTL) ? nextUrl : prevUrl })
        localStorage.setItem('reader.direction', direction)
        if (this.renderingMode != null) {
          this.resetRenderer()
        }
      }
    }

    setRenderingMode(mode = Reader.RENDERING_MODE.SINGLE, noHistory) {
      if (mode !== this.renderingMode) {
        this.renderingMode = mode
        this.container.classList.toggle('single-page', this.isSinglePage)
        this.container.classList.toggle('double-page', this.isDoublePage)
        this.container.classList.toggle('long-strip',  this.isLongStrip)
        localStorage.setItem('reader.renderingMode', mode)
        this.resetRenderer()
        if (!noHistory) {
          this.pushHistory(this.currentPage)
        }
      }
    }

    setDisplayFit(fit = Reader.DISPLAY_FIT.FIT_WIDTH) {
      if (fit !== this.displayFit) {
        this.displayFit = fit
        this.container.classList.toggle('no-resize',  this.isNoResize)
        this.container.classList.toggle('fit-height', this.isFitHeight)
        this.container.classList.toggle('fit-width',  this.isFitWidth)
        this.container.classList.toggle('fit-both',   this.isFitBoth)
        localStorage.setItem('reader.displayFit', fit)
      }
    }

    resetRenderer() {
      this.imageContainer.innerHTML = ''
      switch(this.renderingMode) {
        case Reader.RENDERING_MODE.LONG:
          this.longStripScrollListener = () => { this.renderLongStrip() }
          window.addEventListener('scroll', this.longStripScrollListener)
          this.currentPage = 0
          break
        case Reader.RENDERING_MODE.DOUBLE:
          window.removeEventListener('scroll', this.longStripScrollListener)
          break
        case Reader.RENDERING_MODE.SINGLE:
        default:
          window.removeEventListener('scroll', this.longStripScrollListener)
          this.renderedPages = 1
          break
      }
      this.container.querySelector('.reader-controls-pages .total-pages').textContent = this.totalPages
      if (this.currentPage != null) {
        this.render(this.currentPage)
      }
    }

    waitForRender(f) {
      return requestAnimationFrame(requestAnimationFrame(f))
    }

    setLoading(loading) {
      // loading ? console.time('loading') : console.timeEnd('loading')
      this.isLoading = loading
      this.container.classList.toggle('is-loading', loading)
    }

    tryPreloading(amount = this.preloadPageAmount) {
      const images = []
      for (let i = this.currentPage + 1; i <= this.currentPage + amount &&  i <= this.totalPages; i++) {
        images.push(i)
      }
      this.preload(images)
    }

    preload(images) {
      if (images.length) {
        let pg = images.shift()
        if (!(pg in this.imageCache)) {
          const page = this.getPage(pg)
          if (page != null) {
            page.image.addEventListener('load', (evt) => {
              this.preload(images)
            }, { once: true })
          }
        } else {
          this.preload(images)
        }
      }
    }

    getPage(pg) {
      if (pg == null || pg < 1 || pg > this.totalPages) {
        return null
      } else if (!(pg in this.imageCache)) {
        const img = new Image()
        img.src = this.imageURL(pg)
        this.imageCache[pg] = { image: img, loaded: false, page: pg }
        img.addEventListener('load', (evt) => {
          this.imageCache[pg].loaded = true
        }, { once: true })
      }
      return this.imageCache[pg]
    }

    render(pg) {
      this.previousPage = this.currentPage
      this.currentPage = pg
      switch(this.renderingMode) {
        case Reader.RENDERING_MODE.DOUBLE:
          this.renderDoublePage(pg)
          break
        case Reader.RENDERING_MODE.LONG:
          this.renderLongStrip()
          break
        case Reader.RENDERING_MODE.SINGLE:
        default:
          this.renderSinglePage(pg)
          break
      }
    }

    renderSinglePage(pg) {
      const curImage = this.imageContainer.querySelector('img')
      const page = this.getPage(pg)
      if (page !== null) {
        const changeImg = () => {
          this.imageContainer.appendChild(page.image)
          if (curImage) {
            this.imageContainer.removeChild(curImage)
          }
          // this.imageContainer.scrollIntoView()
          // window.scrollBy(0, -document.querySelector('#top_nav').offsetHeight)
          this.setLoading(false)
          this.container.querySelector('.reader-controls-pages .current-page').textContent = pg
          this.container.querySelector('.reader-controls-pages .page-link-left').href = this.pageLeftURL()
          this.container.querySelector('.reader-controls-pages .page-link-right').href = this.pageRightURL()
          this.updatePageBar(pg)
          this.tryPreloading()
        }
        if (page.loaded) {
          changeImg()
        } else {
          this.setLoading(true)
          page.image.addEventListener('load', changeImg, { once: true })
        }
      }
    }

    renderDoublePage(pg) {
      const curImages = this.imageContainer.querySelectorAll('img')
      const newPages = [this.getPage(pg), this.getPage(pg+1)].filter(pg => pg)
      const changeImg = () => {
        if (newPages.every(pg => pg.loaded)) {
          if (newPages.length > 1 && newPages.some(pg => pg.image.width > pg.image.height && pg.image.width > this.container.offsetWidth/2)) {
            if (this.isPageTurnForwards || this.previousPage - this.currentPage === 1) {
              newPages.pop()
            } else {
              newPages.shift()
              this.currentPage = pg+1
            }
          }
          newPages.forEach(page => this.imageContainer.appendChild(page.image))
          if (curImages) {
            const newImages = newPages.map(page => page.image)
            Array.from(curImages).filter(img => !newImages.includes(img)).forEach(img => this.imageContainer.removeChild(img))
          }
          this.renderedPages = newPages.length

          this.setLoading(false)
          this.container.querySelector('.reader-controls-pages .current-page').textContent = `${pg}${this.renderedPages===2 ? ` - ${pg + 1}` : ''}`
          this.container.querySelector('.reader-controls-pages .page-link-left').href = this.pageLeftURL(1)
          this.container.querySelector('.reader-controls-pages .page-link-right').href = this.pageRightURL(1)
          this.updatePageBar(pg + newPages.length - 1)
          this.tryPreloading(Math.max(this.preloadPageAmount, 2))
        }
      }
      newPages.filter(pg => !pg.loaded).forEach(pg => {
        this.setLoading(true)
        pg.image.addEventListener('load', changeImg, { once: true })
      })
      changeImg()
    }

    renderLongStrip() {
      if (this.currentPage === 0) {
        this.currentPage++
      }
      const canRenderNext = () => {
        return this.previousPage + 1 === this.currentPage && (window.scrollY + window.innerHeight*2 >= this.imageContainer.offsetTop + this.imageContainer.offsetHeight)
      }
      if (canRenderNext()) {
        const page = this.getPage(this.currentPage)
        this.previousPage = -1
        const loadPage = () => {
          this.imageContainer.appendChild(page.image)
          if (this.currentPage === this.totalPages) {
            window.removeEventListener('scroll', this.longStripScrollListener)
          } else {
            this.render(this.currentPage + 1)
          }
        }
        if (!page.loaded) {
          page.image.addEventListener('load', () => { loadPage() }, { once: true })
        } else {
          loadPage()
        }
      }
    }

    updatePageBar(pg) {
      const notch = 100 / Math.max(this.totalPages, 1)

      const thumb = this.container.querySelector('.reader-page-bar .thumb')
      thumb.style.float = this.isDirectionLTR ? 'left' : 'right'
      thumb.style.width = Math.min((pg) * notch, 100) + '%'

      this.container.querySelector('.reader-page-bar .track').style.background =
        `#444 repeating-linear-gradient(
        to ${this.isDirectionRTL ? 'left' : 'right'},
        #444,
        #444 calc(${notch}% - 3px),
        #666 ${notch}%)`
    }

    moveToPage(pg, noHistory) {
      if (this.isLoading || this.isLongStrip) {
        return
      }
      if (pg <= 0 || pg > this.totalPages) {
        document.location = this.pageURL(this.data.chapter_id, pg)
      } else if (pg !== this.currentPage) {
        // order is important: render, push to history, scroll to top
        // it lets history items retain their scroll position
        this.render(pg)
        if (!noHistory) {
          this.pushHistory(this.currentPage)
        }
        this.imageContainer.scrollIntoView()
        window.scrollBy(0, -document.querySelector('#top_nav').offsetHeight)
      }
    }

    moveToChapter(ch) {
      document.location = this.pageURL(ch)
    }

    turnPageLeft(pages = this.isDoublePage ? 2 : 1) {
      this.turnPage(true, pages)
    }
    turnPageRight(pages = this.isDoublePage ? 2 : 1) {
      this.turnPage(false, pages)
    }
    turnPage(toLeft, pages = this.isDoublePage ? 2 : 1) {
      if (toLeft === this.isDirectionLTR) {
        if (this.isDoublePage && this.currentPage === 2) {
          pages = 1
        }
        this.moveToPage(this.currentPage - pages)
      } else {
        if (this.isDoublePage && this.renderedPages === 1) {
          pages = 1
        }
        this.moveToPage(this.currentPage + pages)
      }
    }

    pushHistory(pg) {
      window.history.pushState({
          page: pg,
          mode: this.renderingMode,
        },
        null,
        this.pageURL(this.data.chapter_id, pg)
      )
    }

    registerEvents() {
      window.onpopstate = (evt) => {
        if (evt.state != null) {
          // this.currentPage = null
          this.setRenderingMode(evt.state.mode, true)
          this.moveToPage(evt.state.page, true)
        }
      }

      const track = this.container.querySelector('.reader-page-bar .track')
      track.addEventListener('click', (evt) => {
        evt.stopPropagation()
        const prc = (evt.clientX - track.offsetLeft) / track.offsetWidth
        const notch = 1 / Math.max(this.totalPages, 1)
        const pg = Math.ceil((this.isDirectionLTR ? prc : 1 - prc) / notch)
        this.moveToPage(this.isDoublePage ? Math.max(pg, 1) : pg)
      })
      this.imageContainer.addEventListener('click', (evt) => {
        evt.stopPropagation()
        const isLeft = (evt.clientX - this.imageContainer.offsetLeft < this.imageContainer.offsetWidth / 2)
        this.turnPage(isLeft)
      })
      this.container.querySelector('.page-link-left').addEventListener('click', (evt) => {
        evt.preventDefault()
        this.turnPageLeft(1)
      })
      this.container.querySelector('.page-link-right').addEventListener('click', (evt) => {
        evt.preventDefault()
        this.turnPageRight(1)
      })
      this.container.querySelector('.reader-controls-collapser').addEventListener('click', (evt) => {
        evt.preventDefault()
        const t = this.container.querySelector('.reader-controls-wrapper').classList.toggle('collapsed')
        if (t) {
          this.container.querySelector('.reader-controls-collapser span').classList.replace('fa-caret-right', 'fa-caret-left')
        } else {
          this.container.querySelector('.reader-controls-collapser span').classList.replace('fa-caret-left', 'fa-caret-right')
        }
      })

      // remove the current listener
      jQuery(document).off('keydown')
      document.addEventListener('keydown', (evt) => {
        evt.stopPropagation()
        if (evt.altKey || evt.ctrlKey || evt.metaKey) {
          return
        }
        if (evt.target.tagName === 'BODY') {
          switch (evt.key.toLowerCase()) {
            case 'arrowleft':
            case 'left':
            case 'a':
              return this.turnPageLeft()
            case 'arrowright':
            case 'right':
            case 'd':
              return this.turnPageRight()
            case 'w':
              return window.scrollBy({ behavior: 'smooth', left: 0, top: -3 * parseFloat(window.getComputedStyle(this.container)['line-height']) })
            case 's':
              return window.scrollBy({ behavior: 'smooth', left: 0, top: 3 * parseFloat(window.getComputedStyle(this.container)['line-height']) })
            case 'f':
              if (evt.shiftKey) {
                return this.setDisplayFit(this.displayFit % 2 + 3)
              }
              return this.setDisplayFit(this.displayFit % 2 + 1)
            case 'g':
              return this.setRenderingMode(this.renderingMode % 3 + 1)
            case 'h':
              return this.setDirection(this.direction % 2 + 1)
            case 't':
              // return this.container.querySelector('.reader-controls-wrapper').classList.toggle('collapsed')
              return this.container.classList.toggle('hide-page-bar')
          }
        }
      })
    }
  }

  Reader.RENDERING_MODE = {
    SINGLE: 1,
    DOUBLE: 2,
    LONG:   3,
  }
  Reader.DIRECTION = {
    LTR: 1,
    RTL: 2,
  }
  Reader.DISPLAY_FIT = {
    FIT_BOTH:   1,
    FIT_WIDTH:  2,
    FIT_HEIGHT: 3,
    NO_RESIZE:  4,
  }

  const reader = new Reader()

})()