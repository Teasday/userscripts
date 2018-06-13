// ==UserScript==
// @name         MangaDex Reader
// @namespace    Teasday
// @version      0.4.2
// @license      GNU GPLv3
// @description  ｷﾀ━━━━━━(ﾟ∀ﾟ)━━━━━━!!!!!
// @author       Teasday
// @match        https://mangadex.org/chapter/*
// @match        http://beta.mangadex.org/chapter/*
// @icon         https://mangadex.org/favicon.ico
// @run-at       document-end
// @require      https://raw.githubusercontent.com/bubkoo/natsort/master/dist/natsort.min.js
// @require      https://raw.githubusercontent.com/Teasday/userscripts/master/mangadex-reader/renderer.js
// @require      https://raw.githubusercontent.com/Teasday/userscripts/master/mangadex-reader/api.js
// @resource     style https://raw.githubusercontent.com/Teasday/userscripts/master/mangadex-reader/style.css
// @resource     html https://raw.githubusercontent.com/Teasday/userscripts/master/mangadex-reader/index.html
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

/* global API Renderer */

/* jshint asi: true */

(function() {
  'use strict'

  // classList.replace() polyfill, blame Edge
  // https://github.com/eligrey/classList.js
  if (!("replace" in document.createElement("_").classList)) {
    DOMTokenList.prototype.replace = function (token, replacement_token) {
      var tokens = this.toString().split(" "), index = tokens.indexOf(token + "");
      if (~index) {
        tokens = tokens.slice(index);
        this.remove.apply(this, tokens);
        this.add(replacement_token);
        this.add.apply(this, tokens.slice(1));
      }
    }
  }

  function jqFetch(opts) {
    return new Promise((resolve, reject) => {
      jQuery.ajax(opts).done(resolve).fail(reject)
    })
  }

  class Reader {
    constructor() {
      document.body.appendChild(document.querySelector('script[data-type="chapter"]').cloneNode(true))
      this.loadSettings()
      this.initializeContainer()
      this.container = document.querySelector('div[role="main"]')
      this.imageContainer = this.container.querySelector('.reader-images')
      const path = document.querySelector('meta[property="og:url"]').content.split('/')
      this.setChapter(parseInt(path[4])).then(() => {
        console.log(this.chapter)
        this.registerEvents()
        // this.saveAllSettings()
        let page = path.length === 6 ? parseInt(path[5]) || 1 : 1
        if (page === -1) {
          page = this.chapter.totalPages
        }
        this.moveToPage(page, false)
        this.pushHistory(this.currentPage, true)
      }).catch((err) => {
        console.error(err)
      })
    }

    loadSettings() {
      this.settings = {}
      const defaults = {
        'displayFit': Reader.DISPLAY_FIT.FIT_BOTH,
        'direction': Reader.DIRECTION.LTR,
        'renderingMode': Reader.RENDERING_MODE.SINGLE,
        'scrollingSpeed': 3,
        'preloadPages': 3,
        'swipeSensitivity': 3,
        'pageTapTurn': 1,
        'showDropdownTitles': 1,
        'hideHeader': 0,
      }
      for (let [key, def] of Object.entries(defaults)) {
        const value = parseInt(localStorage.getItem(`reader.${key}`))
        if (isNaN(value)) {
          this.settings[key] = def
          // this.saveSetting(key, def)
        } else {
          this.settings[key] = value
          // this.saveSetting(key, value)
        }
      }
    }

    saveSetting(key, value) {
      this.settings[key] = value
      localStorage.setItem(`reader.${key}`, value)
      this.updateSettingUI(key)
    }

    saveAllSettings() {
      for (let [key, value] of Object.entries(this.settings)) {
        this.saveSetting(key, value)
      }
    }

    updateSettingUI(key) {
      const value = this.settings[key]
      this.container.querySelectorAll(`#modal-settings input[data-setting="${key}"]`).forEach(n => { n.value = value })
      this.container.querySelectorAll(`#modal-settings select[data-setting="${key}"]`).forEach(n => { n.value = value })
      this.container.querySelectorAll(`#modal-settings button[data-setting="${key}"]`).forEach(n => { n.classList.toggle('active', n.dataset.value == value) })
      switch(key) {
        case 'direction':
          this.setDirection(value)
          this.updateChapterLinks()
          this.setRenderer()
          break
        case 'renderingMode':
          this.setRenderer(value)
          break
        case 'displayFit':
          this.setDisplayFit(value)
          break
        case 'showDropdownTitles':
          this.updateControlsUI()
          break
        case 'hideHeader':
          document.querySelector('nav.navbar').classList.toggle('d-none', value)
          // FIXME: bootstrap 3 legacy
          document.querySelector('nav.navbar').classList.toggle('hidden', value)
          document.querySelector('#fullscreen-button').classList.toggle('active', value)
      }
    }

    setChapter(id) {
      this.isLoading = true
      return API.Chapter.create(id).then((chapter) => {
        this.chapter = chapter
        this.imageCache = {}
        this.currentPage = null
        this.chapter.makeMangaChapterList()
        this.updateUI()
        this.container.classList.toggle('native-long-strip', this.manga.isLongStrip)
        if (this.manga.isLongStrip) {
          this.setRenderer(Reader.RENDERING_MODE.LONG)
          this.setDisplayFit(Reader.DISPLAY_FIT.FIT_WIDTH)
        }
        this.isLoading = false
        return Promise.resolve()
      }).catch((err) => {
        this.isLoading = false
        this.imageContainer.innerHTML = `<div class="alert alert-danger"><strong><span class='fas fa-exclamation-circle fa-fw' aria-hidden='true' title='Failed'></span> ${err}</strong><br>Try reloading the page.</div>`
        return Promise.reject(err)
      })
    }

    get manga() { return this.chapter.manga }
    get renderedPages () { return this.renderer != null ? this.renderer.renderedPages : 0 }

    updateUI() {
      this.updateControlsUI()
      for (let i in this.settings) {
        this.updateSettingUI(i)
      }
    }

    initializeContainer() {
      GM_addStyle(GM_getResourceText('style'))
      document.body.style.removeProperty('margin-bottom')
      // FIXME: bootstrap 3 legacy
      document.querySelector('footer').classList.add('hidden-lg', 'hidden-md')
      document.querySelector('footer').classList.add('d-md-none')
      const container = document.querySelector('div[role=main]')
      container.classList.replace('container', 'reader')
      container.innerHTML = GM_getResourceText('html')
      return container
    }

    updateControlsUI() {
      const title =
        `<div style="font-size:1.25em; text-align:center">
          ${Reader.flagImg(this.manga.langCode, this.manga.langName)}
          <a title="${this.manga.title}" href="${this.manga.url}">${this.manga.title}</a>
        </div>
        <div style="font-size:1em; text-align:center;">
          ${this.chapter.title}
        </div>`
      const chapters = this.manga.chapterList.slice().reverse().reduce((a, ch) =>
        a+`<option value="${ch.id}"${ch.id===this.chapter.id ? 'selected' : ''}>
          ${this.manga.getChapterTitle(ch.id, !this.settings.showDropdownTitles)}
        </option>`, '')
      const groups = this.manga.getGroupsOfChapter(this.chapter.id).reduce((a, g) =>
        a+`<li>
          ${Reader.flagImg(g.lang_code, g.lang_code)}
          ${g.id == this.chapter.id ?
            `<b>${[g.group_name, g.group_name_2, g.group_name_3].filter(n => n).join(' | ')}</b>` :
            `<a href="/chapter/${g.id}" data-chapter="${g.id}">${[g.group_name, g.group_name_2, g.group_name_3].filter(n => n).join(' | ')}</a>`}
        </li>`,'')

      this.container.querySelector('.reader-controls-title').innerHTML = title
      this.container.querySelector('.reader-controls-chapters select').innerHTML = chapters
      this.container.querySelector('.reader-controls-groups ul').innerHTML = groups
      this.container.querySelector('#comment-button').href = this.pageURL(this.chapter.id) + '/comments'
      this.updateChapterLinks()
    }

    updateChapterLinks() {
      const update = (toLeft) => {
        if (this.settings.direction != null) {
          let id = (toLeft === this.isDirectionLTR) ? this.chapter.prevChapterId : this.chapter.nextChapterId
          return (a) => {
            a.dataset.chapter = id
            a.href = this.pageURL(id)
            a.title = this.manga.getChapterTitle(id) || 'Back to manga'
          }
        }
      }
      Array.from(this.container.querySelectorAll('a.chapter-link-left')).forEach(update(true))
      Array.from(this.container.querySelectorAll('a.chapter-link-right')).forEach(update(false))
    }

    updatePageLinks(pg) {
      pg = `${pg}${this.renderedPages===2 ? ` - ${pg + 1}` : ''}`
      this.container.querySelector('.reader-controls-pages .current-page').textContent = pg
      this.container.querySelector('.reader-controls-pages .total-pages').textContent = this.chapter.totalPages
      this.container.querySelector('.reader-controls-pages .page-link-left').href = this.pageLeftURL(1)
      this.container.querySelector('.reader-controls-pages .page-link-right').href = this.pageRightURL(1)
    }

    updatePageBar(pg) {
      const notch = 100 / Math.max(this.chapter.totalPages, 1)

      const trail = this.container.querySelector('.reader-page-bar .trail')
      trail.style.float = this.isDirectionLTR ? 'left' : 'right'
      trail.style.width = Math.min(pg * notch, 100) + '%'
      const thumb = this.container.querySelector('.reader-page-bar .thumb')
      thumb.style.float = this.isDirectionRTL ? 'left' : 'right'
      thumb.style.width = 100/pg*this.renderedPages + '%'

      this.container.querySelector('.reader-page-bar .track').style.background =
        `#222 repeating-linear-gradient(
        to ${this.isDirectionRTL ? 'left' : 'right'},
        #222,
        #222 calc(${notch}% - 2px),
        #666 ${notch}%)`
    }

    get isSinglePage()   { return this.settings.renderingMode === Reader.RENDERING_MODE.SINGLE }
    get isDoublePage()   { return this.settings.renderingMode === Reader.RENDERING_MODE.DOUBLE }
    get isLongStrip()    { return this.settings.renderingMode === Reader.RENDERING_MODE.LONG }
    get isNoResize()     { return this.settings.displayFit === Reader.DISPLAY_FIT.NO_RESIZE }
    get isFitHeight()    { return this.settings.displayFit === Reader.DISPLAY_FIT.FIT_HEIGHT }
    get isFitWidth()     { return this.settings.displayFit === Reader.DISPLAY_FIT.FIT_WIDTH }
    get isFitBoth()      { return this.settings.displayFit === Reader.DISPLAY_FIT.FIT_BOTH }
    get isDirectionLTR() { return this.settings.direction === Reader.DIRECTION.LTR }
    get isDirectionRTL() { return this.settings.direction === Reader.DIRECTION.RTL }

    pageURL(id, pg) {
      if (id != null && id != 0) {
        if (pg != null) {
          if (pg === 0) {
            return this.pageURL(this.chapter.prevChapterId, -1)
          } else if (pg > this.chapter.totalPages) {
            return this.pageURL(this.chapter.nextChapterId)
          }
          return `/chapter/${id}/${pg}`
        }
        return `/chapter/${id}`
      }
      return this.manga.url
    }
    pageLeftURL(pages = this.isDoublePage ? 2 : 1) {
      return this.pageURL(this.chapter.id, Math.min(this.currentPage + (this.isDirectionLTR ? -pages : pages)), 0)
    }
    pageRightURL(pages = this.isDoublePage ? 2 : 1) {
      return this.pageURL(this.chapter.id, Math.min(this.currentPage + (this.isDirectionLTR ? pages : -pages)), 0)
    }

    setRenderer(mode = this.settings.renderingMode, doRender = true) {
      if (this.renderer != null) {
        this.renderer.destroy()
      }
      switch(mode) {
        case Reader.RENDERING_MODE.LONG:
          this.renderer = new Renderer.LongStrip(this)
          break
        case Reader.RENDERING_MODE.DOUBLE:
          this.renderer = new Renderer.DoublePage(this)
          break
        case Reader.RENDERING_MODE.SINGLE:
        default:
          this.renderer = new Renderer.SinglePage(this)
          break
        case Reader.RENDERING_MODE.ALERT:
          this.renderer = new Renderer.Alert(this)
          break
        case Reader.RENDERING_MODE.RECS:
          this.renderer = new Renderer.Recommendations(this)
          break
      }
      this.currentRenderingMode = mode
      this.container.dataset.renderer = this.renderer.name
      if (doRender && this.currentPage != null) {
        this.render(this.currentPage)
      }
    }

    setDirection(direction) {
      this.container.dataset.direction = Reader.DIRECTION.LTR === direction ? 'ltr' : 'rtl'
    }

    setDisplayFit(fit) {
      this.container.dataset.display = Reader.DISPLAY_FIT_STR[fit]
    }

    get isLoading() {
      return this._isLoading
    }
    set isLoading(loading) {
      if (this._isLoading !== loading) {
        this._isLoading = loading
        this.container.classList.toggle('is-loading', loading)
      }
    }

    tryPreloading(amount = this.settings.preloadPages) {
      const images = []
      const start = this.currentPage + this.renderedPages
      const limit = Math.min(this.chapter.totalPages + 1, start + amount)
      for (let i = start; i < limit; i++) {
        images.push(i)
      }
      this.preload(images)
    }

    preload(images) {
      if (images.length) {
        let pg = images.shift()
        if (!(pg in this.imageCache)) {
          this.getPage(pg, true).then((page) => {
            this.preload(images)
          }).catch((err) => {
            console.error('preload failed',err)
          })
        } else {
          this.preload(images)
        }
      }
    }

    getPage(pg, inBackground = false) {
      return new Promise((resolve, reject) => {
        if (pg == null || pg < 1 || pg > this.chapter.totalPages) {
          return resolve(null)
        } else if (!(pg in this.imageCache)) {
          if (!inBackground) {
            this.isLoading = true
          }
          // const img = new Image()
          const img = document.createElement('img')
          img.dataset.page = pg
          img.src = this.chapter.imageURL(pg)
          this.imageCache[pg] = { image: img, loaded: false, page: pg }
          img.addEventListener('load', () => {
            if (!inBackground) {
              this.isLoading = false
            }
            this.imageCache[pg].loaded = true
            return resolve(this.imageCache[pg])
          }, { once: true })
          img.addEventListener('error', (err) => {
            console.error(err)
            throw new Error(`Page ${pg} failed to load.`)
          }, { once: true })
        } else {
          return resolve(this.imageCache[pg])
        }
      })
    }

    render(pg) {
      if (pg == null || this.renderer == null) {
        return Promise.reject()
      }
      if (typeof pg === 'number') {
        this.previousPage = this.currentPage
        this.currentPage = pg
      }
      return this.renderer.render(pg).then(() => {
        this.updatePageLinks(this.currentPage)
        this.updatePageBar(this.currentPage + this.renderedPages - 1)
        this.tryPreloading()
      }).catch((err) => {
        // this.isLoading = false
        // this.renderer = new Renderer.Alert(this)
        // this.renderer.render({type:'danger', msg:err.message})
      })
    }

    moveToPage(pg, useHistory = true) {
      if (this.isLoading || !(this.isSinglePage || this.isDoublePage)) {
        return
      }
      if (pg === -1) {
        this.moveToPage(this.chapter.totalPages, useHistory)
      } else if (pg === 0) {
        this.moveToChapter(this.chapter.prevChapterId, -1, useHistory)
      } else if (pg > this.chapter.totalPages) {
        this.moveToChapter(this.chapter.nextChapterId, 1, useHistory)
      } else if (pg !== this.currentPage) {
        // render, push to history, scroll to top
        // lets history items retain their scroll position
        this.render(pg).then(() => {
          if (useHistory) {
            this.pushHistory(this.currentPage)
            // this.imageContainer.scrollIntoView(this.isFitWidth || this.isNoResize)
            document.querySelector('.reader-main').scrollIntoView(this.isFitWidth || this.isNoResize)
            if (this.isFitWidth || this.isNoResize) {
              window.scrollBy(0, -document.querySelector('#top_nav').offsetHeight)
            }
          }
        }).catch((err) => {
          console.error('render error',err)
        })
      }
    }

    moveToChapter(id, pg = 1, useHistory = true) {
      if (this.isLoading) {
        return
      }
      this.isLoading = true
      if (id === 0) {
        // reload manga data to see if there has been an update
        this.chapter.loadManga(true).then(() => {
          if (this.chapter.nextChapterId !== 0) {
            this.isLoading = false
            this.moveToChapter(this.chapter.nextChapterId, 1, useHistory)
          } else {
            API.Follows.create().then((follows) => {
              const recs = Object.values(follows.unreadManga)
              if (recs.length > 0) {
                this.isLoading = false
                this.setRenderer(Reader.RENDERING_MODE.RECS, false)
                this.render(recs).then(() => {
                  this.pushHistory('recommendations')
                })
              } else {
                this.exitToURL(this.manga.url)
              }
            })
          }
        })
      } else {
        return this.setChapter(id).then(() => {
          if (this.isLongStrip) {
            this.pushHistory(this.currentPage)
          } else {
            this.moveToPage(pg, useHistory)
          }
        })
      }
    }

    exitToURL(url) {
      if (!this.exiting) {
        this.exiting = true
        this.isLoading = true
        window.location = url
      }
    }

    turnPageLeft(pages = this.isDoublePage ? 2 : 1) {
      this.turnPage(true, Math.max(pages, 0))
    }

    turnPageRight(pages = this.isDoublePage ? 2 : 1) {
      this.turnPage(false, Math.max(pages, 0))
    }

    turnPage(toLeft, pages = this.isDoublePage ? 2 : 1) {
      if (toLeft === this.isDirectionLTR) {
        if (this.isLongStrip) {
          return this.moveToChapter(this.chapter.prevChapterId)
        } else if (this.isDoublePage && this.currentPage <= 2) {
          pages = 1
        }
        this.moveToPage(this.currentPage - pages)
      } else {
        if (this.isLongStrip) {
          return this.moveToChapter(this.chapter.nextChapterId)
        } else if (this.isDoublePage && this.renderedPages === 1) {
          pages = 1
        }
        this.moveToPage(this.currentPage + pages)
      }
    }

    pushHistory(pg, replace = false) {
      const state = {
        page: pg,
        chapter: this.chapter.id,
        mode: this.currentRenderingMode,
      }
      console.log('push',state)
      const url = this.pageURL(this.chapter.id, pg)
      if (replace) {
        window.history.replaceState(state, null, url)
      } else {
        window.history.pushState(state, null, url)
      }
    }

    registerEvents() {
      // history
      window.onpopstate = (evt) => {
        if (evt.state != null) {
          console.log('pop',evt.state)
          if (this.settings.renderingMode !== evt.state.mode && evt.state.mode >= 1 && evt.state.mode <= 3) {
            this.saveSetting('renderingMode', evt.state.mode)
          }
          if (this.currentRenderingMode != evt.state.mode) {
            this.setRenderer(evt.state.mode, false)
          }
          if (evt.state.chapter == this.chapter.id) {
            this.moveToPage(evt.state.page, false)
          } else {
            this.moveToChapter(evt.state.chapter, evt.state.page, false)
          }
        }
      }
      // various page and chapter links
      const track = this.container.querySelector('.reader-page-bar .track')
      track.addEventListener('click', (evt) => {
        evt.stopPropagation()
        const prc = (evt.clientX - track.offsetLeft) / track.offsetWidth
        const notch = 1 / Math.max(this.chapter.totalPages, 1)
        const pg = Math.ceil((this.isDirectionLTR ? prc : 1 - prc) / notch)
        this.moveToPage(this.isDoublePage ? Math.max(pg, 1) : pg)
      })
      this.imageContainer.addEventListener('click', (evt) => {
        evt.stopPropagation()
        if (this.settings.pageTapTurn) {
          const isLeft = (evt.clientX - this.imageContainer.offsetLeft < this.imageContainer.offsetWidth / 2)
          this.turnPage(isLeft)
        }
      })
      $(this.imageContainer).swipe({
        swipe: (evt, direction, distance, duration, fingerCount) => {
          if (this.settings.swipeSensitivity > 0) {
            direction === 'left' ? this.turnPageRight() : this.turnPageLeft()
          }
        },
        threshold: 70 * this.settings.swipeSensitivity,
        cancelThreshold: 10,
        preventDefaultEvents: false,
      })
      // $(this.imageContainer).on('swipe', (evt) => {
      //   console.log(evt)
      // })
      this.container.querySelector('.page-link-left').addEventListener('click', (evt) => {
        evt.preventDefault()
        this.turnPageLeft(1)
      })
      this.container.querySelector('.page-link-right').addEventListener('click', (evt) => {
        evt.preventDefault()
        this.turnPageRight(1)
      })
      const chapterLink = (evt) => {
        evt.preventDefault()
        evt.stopPropagation()
        const chapter = evt.target.dataset.chapter || evt.currentTarget.dataset.chapter
        if (chapter) {
          this.moveToChapter(parseInt(chapter))
        }
      }
      this.container.querySelector('.chapter-link-left').addEventListener('click', chapterLink)
      this.container.querySelector('.chapter-link-right').addEventListener('click', chapterLink)
      this.container.querySelector('.reader-controls-groups ul').addEventListener('click', chapterLink, true)
      this.container.querySelector('#jump-chapter').addEventListener('change', (evt) => {
        const newChapterId = parseInt(evt.target.value)
        if (!this.chapter || this.chapter.id !== newChapterId) {
          this.moveToChapter(newChapterId, 1)
        }
      })
      // action-related stuff
      this.container.querySelector('#reader-controls-collapser').addEventListener('click', (evt) => {
        const isCollapsed = this.container.querySelector('.reader-controls-wrapper').classList.toggle('collapsed')
        this.container.querySelector('#reader-controls-collapser span').style.transform = isCollapsed ? 'rotateY(180deg)' : null
      })
      this.container.querySelector('#fullscreen-button').addEventListener('click', (evt) => {
        this.saveSetting('hideHeader', !this.settings.hideHeader ? 1 : 0)
      })
      this.container.querySelector('#chapter-report-form').addEventListener('submit', (evt) => {
        evt.preventDefault()
        this.container.querySelector('#chapter-report-submit').style.display = 'none'
        this.container.querySelector('#chapter-report-submitting').style.display = null
        const alertContainer = evt.target.querySelector('.alert-container')
        alertContainer.innerHTML = ''
        // fetch(`/ajax/actions.ajax.php?function=chapter_report&id=${this.chapter.id}`, {
        //   method: 'post',
        //   body: new FormData(evt.target),
        //   credentials: 'include',
        //   headers: { 'X-Requested-With': 'XMLHttpRequest' }
        // })
        // .then((res) => res.text())
        // .then((data) => {
        jqFetch({
          url: `/ajax/actions.ajax.php?function=chapter_report&id=${this.chapter.id}`,
          type: 'post',
          data: new FormData(evt.target),
          contentType: false,
          processData: false,
        }).then((data) => {
          if (data) {
            alertContainer.innerHTML = data
          } else {
            alertContainer.innerHTML = "<div class='alert alert-success text-center' role='alert'><strong><span class='fas fa-check-circle fa-fw' aria-hidden='true' title='Success'></span> Success:</strong> This chapter has been reported.</div>"
          }
          return Promise.resolve()
        }).catch((err) => {
          alertContainer.innerHTML = "<div class='alert alert-danger text-center' role='alert'>Something weird went wrong. Details in the Console (F12), hopefully.</div>"
          console.error(err)
          return Promise.resolve()
        }).then(() => {
          this.container.querySelector('#chapter-report-submitting').style.display = 'none'
          this.container.querySelector('#chapter-report-submit').style.display = null
        })
      })
      const getSettingValue = (evt) => {
        const value = parseInt(evt.target.dataset.value != null ? evt.target.dataset.value : evt.target.value)
        if (!isNaN(value)) {
          this.saveSetting(evt.target.dataset.setting, value)
        }
      }
      this.container.querySelectorAll('#modal-settings input[data-setting]').forEach(c => c.addEventListener('change', getSettingValue))
      this.container.querySelectorAll('#modal-settings select[data-setting]').forEach(c => c.addEventListener('change', getSettingValue))
      this.container.querySelectorAll('#modal-settings button[data-setting]').forEach(c => c.addEventListener('click', getSettingValue))

      // keyboard shortcuts
      // FIXME: remove the current listener
      jQuery(document).off('keydown')
      jQuery(document).off('keyup')
      document.addEventListener('keydown', (evt) => {
        if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.key === 'OS' /*|| document.body.classList.contains('modal-open')*/) {
          return
        }
        evt.stopPropagation()
        const tag = (evt.target || evt.srcElement).tagName
        if (!['INPUT','SELECT','TEXTAREA'].includes(tag)) {
          switch (evt.key.toLowerCase()) {
            case 'arrowleft':
            case 'left':
            case 'a':
              evt.preventDefault()
              return this.turnPageLeft(evt.shiftKey ? 1 : undefined)
            case 'arrowright':
            case 'right':
            case 'd':
              evt.preventDefault()
              return this.turnPageRight(evt.shiftKey ? 1 : undefined)
            case 'arrowup':
            case 'up':
            case 'w':
              evt.preventDefault()
              return Reader.scroll(-this.settings.scrollingSpeed)
            case 'arrowdown':
            case 'down':
            case 's':
              evt.preventDefault()
              return Reader.scroll(this.settings.scrollingSpeed)
            case 'f':
              return this.saveSetting('displayFit', this.settings.displayFit % 2 + (evt.shiftKey ? 3 : 1))
            case 'g':
              return this.saveSetting('renderingMode', this.settings.renderingMode % 3 + 1)
            case 'h':
              return this.saveSetting('direction', this.settings.direction % 2 + 1)
            case 'r':
              this.container.querySelector('#fullscreen-button').click()
              if (evt.shiftKey) {
                this.container.querySelector('#reader-controls-collapser').click()
              }
              return
          }
        }
      })

      /*let prevState = 0
      const loop = () => {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
        if (gamepads) {
          const gp = gamepads[0]
          if (gp.axes[0] === -1.0 && prevState !== -1.0) {
            this.turnPageLeft()
          } else if (gp.axes[0] === 1.0 && prevState !== 1.0) {
            this.turnPageRight()
          }
          prevState = gp.axes[0]
          requestAnimationFrame(loop)
        }
      }
      window.addEventListener("gamepadconnected", loop)*/
    }

    static scroll(n = 3) {
      window.scrollBy({
        behavior: 'smooth',
        left: 0,
        top: n * 40
      })
    }

    static flagImg (langCode, langName) {
      return `<img style="display:inline-block; border-radius:5px;" src="https://s1.mangadex.org/images/flags/${langCode}.png" alt="${langName}" title="${langName}">`
    }
  }

  Reader.RENDERING_MODE = {
    SINGLE: 1,
    DOUBLE: 2,
    LONG:   3,
    ALERT:  4,
    RECS:   5,
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
  Reader.DISPLAY_FIT_STR = {
    1: 'fit-both',
    2: 'fit-width',
    3: 'fit-height',
    4: 'no-resize',
  }
  new Reader()
})();