// ==UserScript==
// @name         MangaDex Reader
// @namespace    Teasday
// @version      0.2
// @license      GNU GPLv3
// @description  ｷﾀ━━━━━━(ﾟ∀ﾟ)━━━━━━ !!!!!
// @author       Teasday
// @match        https://mangadex.org/chapter/*
// @icon         https://mangadex.org/favicon.ico
// @run-at       document-end
// @require      https://raw.githubusercontent.com/bubkoo/natsort/master/dist/natsort.min.js
// @grant        none
// ==/UserScript==

/* jshint asi: true */
(function() {
  'use strict'

  class Manga {
    constructor(data) {
      this._data = data.manga
      this.chapters = Object.entries(data.chapter).map(([id,data]) => { data.id = parseInt(id); return data })
      Manga.sortChapters(this.chapters)
      this.chapterList = []
    }

    get id() { return this._data.id }
    get title() { return this._data.title }
    get url() { return this._data.url }
    get langCode() { return this._data.lang_code }
    get langName() { return this._data.lang_name }
    get isLongStrip() { return !!this._data.long_strip }

    getChapterData(id) {
      return this.chapters.find(c => c.id === id)
    }

    getChapterTitle(id) {
      const ch = this.getChapterData(id)
      if (!ch) {
        return null
      } else {
        let title = ''
        if (ch.volume)  title += `Vol. ${ch.volume} `
        if (ch.chapter) title += `Ch. ${ch.chapter} `
        if (ch.title)   title += `${ch.title}`
        if (!title)     title = 'Oneshot'
        return title.trim()
      }
    }

    makeChapterList(lang, [g1, g2, g3]) {
      this.chapterList = []
      let best = null
      for (let ch of this.chapters.filter(c => c.lang_code === lang)) {
        if (!best) {
          best = ch
        } else {
          if (!ch.chapter && !ch.volume || (best.chapter !== ch.chapter || best.volume !== ch.volume)) {
            this.chapterList.push(best)
            best = ch
          } else if (ch.group_id === g1 && ch.group_id_2 === g2 && ch.group_id_3 === g3) {
            best = ch
          }
        }
      }
      this.chapterList.push(best)
      return this.chapterList
    }

    getGroupsOfChapter(id) {
      const cur = this.getChapterData(id)
      if (!cur) {
        return null
      } else {
        const isNonNumbered = cur.volume === "" && cur.chapter === ""
        return this.chapters.filter(c =>
          c.lang_code === cur.lang_code
          && c.volume === cur.volume && c.chapter === cur.chapter
          && (!isNonNumbered || cur.title === c.title)
        )
      }
    }

    getPrevChapterId(id) {
      const index = this.chapterList.findIndex(c => c.id === id)
      if (index <= 0) {
        return 0
      } else {
        return this.chapterList[index - 1].id
      }
    }
    getNextChapterId(id) {
      const index = this.chapterList.findIndex(c => c.id === id)
      if (index === -1 || index === this.chapterList.length - 1) {
        return 0
      } else {
        return this.chapterList[index + 1].id
      }
    }

    static sortChapters(chapters) {
      let sorter = natsort({ asc: true, insensitive: true })
      chapters.sort((a, b) => sorter(a.group_id, b.group_id))
      chapters.sort((a, b) => sorter(a.chapter, b.chapter))
      let pv = ''
      chapters.forEach(c => {
        c.__prev_vol = pv
        if (!!c.volume) {
          pv = c.volume
        }
      })
      chapters.sort((a, b) => sorter(a.volume || a.__prev_vol, b.volume || b.__prev_vol))
      chapters.forEach(c => { delete c.__prev_vol })
    }

    static create(id) {
      if (id in Manga.cache) {
        return Promise.resolve(Manga.cache[id])
      }
      return fetch(new Request(this.API_URL + id, {
        headers: new Headers({
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64)',
          'Cookie': 'mangadex_h_toggle=1'
        })
      }))
      .then((res) => res.json())
      .then((data) => {
        Manga.cache[id] = new Manga(data)
        return Manga.cache[id]
      })
    }

    static get API_URL() { return '/api/3640f3fb/' }
  }
  Manga.cache = {}

  class Chapter {
    constructor(data) {
      this._data = data
    }

    get id() { return this._data.chapter_id }
    get title() { return this._data.chapter_title }
    get langCode() { return this._data.other_chapters[this.id].lang_flag }
    get langName() { return this._data.other_chapters[this.id].lang_name }
    get totalPages() { return this._data.page_array.length }
    // get groupIds() { return [this._data.group_id, this._data.group_id_2, this._data.group_id_3] }
    get groupIds() { return [this._data.other_groups[this.id].group_id, this._data.other_groups[this.id].group_id_2, this._data.other_groups[this.id].group_id_3] }
    // get groupNames() { return [this._data.group_name, this._data.group_name_2, this._data.group_name_3] }
    get groupNames() { return [this._data.other_groups[this.id].group_name, this._data.other_groups[this.id].group_name_2, this._data.other_groups[this.id].group_name_3] }
    get prevChapterId() { return this.manga.getPrevChapterId(this.id) }
    get nextChapterId() { return this.manga.getNextChapterId(this.id) }

    getPage(pg) {
      return pg >= 1 && pg <= this.totalPages ? this._data.page_array[pg - 1] : ''
    }

    imageURL(pg) {
      return this._data.server + this._data.dataurl + '/' + this.getPage(pg)
    }

    makeMangaChapterList() {
      return this.manga.makeChapterList(this._data.other_groups[this.id].lang_flag, this.groupIds)
    }


    static create(id) {
      if (id in Chapter.cache) {
        return Promise.resolve(Chapter.cache[id])
      }
      return fetch(new Request(this.API_URL + id, {
        headers: new Headers({
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64)',
          'Cookie': 'mangadex_h_toggle=1'
        })
      }))
      .then((res) => res.text())
      .then((data) => {
        const [,json] = data.match(/<script data-type="chapter">(.*?)<\/script>/)
        return JSON.parse(json)
      })
      .then((data) => {
        const chapter = new Chapter(data)
        Chapter.cache[id] = chapter
        return Manga.create(chapter._data.manga_id).then((manga) => {
          chapter.manga = manga
          // TODO: all this stuff should be in the manga api
          manga._data.id = chapter._data.manga_id
          manga._data.title = chapter._data.manga_title
          manga._data.url = chapter._data.manga_url
          manga._data.long_strip = chapter._data.long_strip
          manga._data.lang_code = chapter._data.flag_url
          manga._data.lang_name = chapter._data.lang
          return chapter
        })
      })
    }

    static get API_URL() { return '/chapter/' }
  }
  Chapter.cache = {}

  class Reader {
    constructor() {
      document.body.appendChild(document.querySelector('script[data-type="chapter"]').cloneNode(true))
      this.initializeContainer()

      this.container = document.querySelector('div[role="main"]')
      this.imageContainer = this.container.querySelector('.reader-images')
      this.imageCache = {}
      this.preloadPageAmount = 3
      this.renderedPages = 0
      this.currentPage = null

      const path = document.querySelector('meta[property="og:url"]').content.split('/')
      this.setChapter(parseInt(path[4])).then(() => {
        this.setScrollingSpeed(parseInt(localStorage.getItem('reader.scrollingSpeed')) || undefined)
        this.setDisplayFit(parseInt(localStorage.getItem('reader.displayFit')) || undefined)
        this.setDirection(parseInt(localStorage.getItem('reader.direction')) || undefined)
        this.setRenderingMode(parseInt(localStorage.getItem('reader.renderingMode')) || undefined, true)
        this.registerEvents()
        let page = path.length === 6 ? parseInt(path[5]) || 1 : 1
        if (page === -1) {
          page = this.chapter.totalPages
        }
        this.moveToPage(page, true)
        this.pushHistory(this.currentPage, true)
      }).catch((err) => {
        console.error(err)
      })
    }

    setChapter(id) {
      this.setLoading(true)
      return Chapter.create(id).then(chapter => {
        this.setLoading(false)
        this.chapter = chapter
        this.manga = chapter.manga
        this.imageCache = {}
        this.renderedPages = 0
        this.currentPage = null
        if (!this.manga.chapterList.length) {
          chapter.makeMangaChapterList()
        }
        this.updateControlsUI()
      })
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
        .reader.fullscreen {
          margin-top: -70px;
          margin-bottom: -70px;
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
        .reader-page-bar .trail {
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
        .reader-images img {
          margin: 1px;
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
          height: calc(100vh - 52px - 35px);
        }
        .reader.fullscreen.fit-height .reader-images,
        .reader.fullscreen.fit-both .reader-images {
          height: 100vh;
        }
        .reader.fullscreen .reader-page-bar,
        .reader.long-strip .reader-page-bar,
        .reader.long-strip .reader-controls-pages {
          max-height: 0;
          min-height: 0;
          overflow: hidden;
          padding: 0;
          border: 0;
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
        .reader-page-bar .trail,
        .reader-page-bar .thumb {
          height: 100%;
          background: #ddd;
          border-radius: 5px;
          float: left;
          width: 0%;
        }
        .reader-page-bar .trail {
          background: rgba(255, 255, 255, 0.35);
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
          .reader.fullscreen,
          .reader.fullscreen .reader-controls-wrapper {
            top: 0;
            min-height: 100vh;
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
      const container = document.querySelector('div[role=main]')
      const footer = document.querySelector('footer p').innerHTML
      document.querySelector('footer').classList.add('hidden-lg', 'hidden-md')
      container.classList.replace('container', 'reader')
      container.innerHTML = `
      <div class="reader-main">
        <div class="reader-images"></div>
        <div class="reader-page-bar">
          <div class="track"><div class="trail"><div class="thumb"></div></div></div>
        </div>
        <div aria-hidden="true" title="" class="fas fa-circle-notch fa-spin reader-load-icon"></div>
      </div>

      <div class="reader-controls-wrapper">
        <div class="reader-controls-collapser">
          <span class="fas fa-caret-right fa-fw" aria-hidden="true" title="Collapse menu" style="font-size:30px;"></span>
        </div>
        <div class="reader-controls">
          <div class="reader-controls-row reader-controls-title" style="flex-flow:column">
          </div>
          <div class="reader-controls-row reader-controls-chapters">
            <a class="chapter-link-left" style="font-size:30px" title="" href="">
              <span class="fas fa-angle-left fa-fw" aria-hidden="true"></span>
            </a>
            <div style="flex:1 0 auto;width:0;">
              <select class="form-control selectpicker" id="jump-chapter" name="jump-chapter" data-size="10">
              </select>
            </div>
            <a class="chapter-link-right" style="font-size:30px" title="" href="">
              <span class="fas fa-angle-right fa-fw" aria-hidden="true"></span>
            </a>
          </div>
          <div class="reader-controls-row reader-controls-groups">
            <ul class="list-unstyled">
            </ul>
          </div>
          <div class="reader-controls-row reader-controls-actions">
            <a title="Comment" class="btn btn-default" id="comment-button" style="flex:1 0 auto">
              <span class="far fa-comments fa-fw"></span>
            </a>
            <a title="Reader settings" class="btn btn-default" id="settings-button" style="flex:1 0 auto" data-toggle="modal" data-target="#modal-settings">
              <span class="fas fa-cog fa-fw"></span>
            </a>
            <a title="Fullscreen" class="btn btn-default" id="fullscreen-button" style="flex:1 0 auto">
              <span class="fas fa-expand fa-fw"></span>
            </a>
            <a title="Report" class="btn btn-default" id="report-button" style="flex:1 0 auto" data-toggle="modal" data-target="#modal-report">
              <span class="fas fa-flag fa-fw"></span>
            </a>
          </div>
          <div class="reader-controls-row reader-controls-mode" style="flex-flow:column; align-items:flex-start;">
            <div><kbd>^f</kbd> <span class="fas fa-compress fa-fw" aria-hidden="true" title="Display fit"></span> <span class="no-resize">No resize</span><span class="fit-both">Fit to container</span><span class="fit-height">Fit height</span><span class="fit-width">Fit width</span></div>
            <div><kbd>&nbsp;g</kbd> <span class="fas fa-book fa-fw" aria-hidden="true" title="Reader mode"></span> <span class="single-page">Single page</span><span class="double-page">Double page</span><span class="long-strip">Long strip</span></div>
            <div><kbd>&nbsp;h</kbd> <span class="fas fa-exchange-alt fa-fw" aria-hidden="true" title="Direction"></span> <span class="direction-ltr">Left to right</span><span class="direction-rtl">Right to left</span></div>
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

      <div class="modal" id="modal-report" tabindex="-1" role="dialog" aria-labelledby="modal-report-label">
        <div class="modal-dialog" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
              <h4 class="modal-title" id="modal-report-label"><span class='fas fa-flag fa-fw' aria-hidden='true' title=''></span> Report chapter</h4>
            </div>
            <form id="chapter-report-form" method="post" class="form-horizontal">
              <div class="modal-body">
                <div class="form-group">
                  <label for="type_id" class="col-sm-3 control-label">Reason</label>
                  <div class="col-sm-9">
                    <select required title="Select a reason" class="form-control selectpicker" name="type_id">
                      <option value="1">All images broken</option>
                      <option value="2">Some images broken</option>
                      <option value="3">Watermarked images</option>
                      <option value="4">Naming rules broken</option>
                      <option value="5">Incorrect group</option>
                      <option value="6">Group policy evasion</option>
                      <option value="7">Official release/Raw</option>
                      <option value="0">Other (Please specify)</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label for="info" class="col-sm-3 control-label">Explanation</label>
                  <div class="col-sm-9">
                    <textarea class="form-control" name="info" placeholder="Optional" ></textarea>
                  </div>
                </div>
                <div class="form-group">
                  <div class="col-sm-offset-3 col-sm-9">
                  </div>
                </div>
                <div class="alert-container"></div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal"><span class='fas fa-undo fa-fw' aria-hidden='true' title=''></span> Close</button>
                <button type="submit" class="btn btn-warning" id="chapter-report-submit"><span class='fas fa-pencil-alt fa-fw' aria-hidden='true' title=''></span> Submit report</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div class="modal" id="modal-settings" tabindex="-1" role="dialog" aria-labelledby="modal-settings-label">
        <div class="modal-dialog" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
              <h4 class="modal-title" id="modal-settings-label"><span class='fas fa-cog fa-fw' aria-hidden='true' title=''></span> Reader settings</h4>
            </div>
            <div class="modal-body form-horizontal">
              <div class="form-group">
                <label class="col-sm-3 control-label">Fit display to</label>
                <div class="col-sm-9" style="display:flex; flex-flow:row wrap;">
                  <button type="button" data-value="1" data-setting="display" class="btn btn-default" style="flex:1 1 24%;">Container</button>
                  <button type="button" data-value="2" data-setting="display" class="btn btn-default" style="flex:1 1 24%;">Width</button>
                  <button type="button" data-value="3" data-setting="display" class="btn btn-default" style="flex:1 1 24%;">Height</button>
                  <button type="button" data-value="4" data-setting="display" class="btn btn-default" style="flex:1 1 24%;">No resize</button>
                </div>
              </div>
              <div class="form-group">
                <label for="info" class="col-sm-3 control-label">Page rendering</label>
                <div class="col-sm-9" style="display:flex; flex-flow:row wrap;">
                  <button type="button" data-value="1" data-setting="rendering" class="btn btn-default" style="flex-grow:1;">Single</button>
                  <button type="button" data-value="2" data-setting="rendering" class="btn btn-default" style="flex-grow:1;">Double</button>
                  <button type="button" data-value="3" data-setting="rendering" class="btn btn-default" style="flex-grow:1;">Long strip</button>
                </div>
              </div>
              <div class="form-group">
                <label for="info" class="col-sm-3 control-label">Direction</label>
                <div class="col-sm-9" style="display:flex; flex-flow:row wrap;">
                  <button type="button" data-value="1" data-setting="direction" class="btn btn-default" style="flex-grow:1;">Left to right</button>
                  <button type="button" data-value="2" data-setting="direction" class="btn btn-default" style="flex-grow:1;">Right to left</button>
                </div>
              </div>
              <div class="form-group">
                <label for="info" class="col-sm-3 control-label">Keyboard scroll</label>
                <div class="col-sm-9" style="display:flex; flex-flow:row wrap;">
                  <button type="button" data-value="1" data-setting="scrolling" class="btn btn-default" style="flex:1 1 24%;">Slow</button>
                  <button type="button" data-value="3" data-setting="scrolling" class="btn btn-default" style="flex:1 1 24%;">Normal</button>
                  <button type="button" data-value="9" data-setting="scrolling" class="btn btn-default" style="flex:1 1 24%;">Fast</button>
                  <button type="button" data-value="21" data-setting="scrolling" class="btn btn-default" style="flex:1 1 24%;">Sanic</button>
                </div>
              </div>
              <div class="form-group">
                <label for="info" class="col-sm-3 control-label">Preload images</label>
                <div class="col-sm-9">
                  <input data-setting="preload" class="form-control" type="number" min="0" max="5" placeholder="0 to 5 images (default: 3)"></input>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-default" data-dismiss="modal"><span class='fas fa-undo fa-fw' aria-hidden='true' title=''></span> Close</button>
            </div>
          </div>
        </div>
      </div>
      `
      return container
    }

    updateControlsUI() {
      const title = `<div style="font-size:1.25em; text-align:center">
          <img style="display:inline-block; border-radius:5px;" src="https://s1.mangadex.org/images/flags/${this.manga.langCode}.png" alt="${this.manga.langName}" title="${this.manga.langName}">
          <!--<span class="fas fa-book fa-fw" aria-hidden="true" title=""></span>-->
          <a title="${this.manga.title}" href="${this.manga.url}">${this.manga.title}</a>
        </div>
        <div style="font-size:1em; text-align:center;">
          ${this.chapter.title}
        </div>`
      const chapters = this.manga.chapterList.slice().reverse().reduce((a, ch) =>
        a+`<option value="${ch.id}"${ch.id===this.chapter.id ? 'selected' : ''}>${this.manga.getChapterTitle(ch.id)}</option>`, '')
      const groups = this.manga.getGroupsOfChapter(this.chapter.id).reduce((a, g) =>
        a+`<li>
          <img style='display:inline-block; border-radius:5px;' src='https://s1.mangadex.org/images/flags/${g.lang_code}.png' alt='${g.lang_code}' title='${g.lang_code}' />
          ${g.id == this.chapter.id ?
            `<b>${[g.group_name, g.group_name_2, g.group_name_3].filter(n => n).join(' | ')}</b>` :
            `<a href="/chapter/${g.id}" data-chapter="${g.id}">${[g.group_name, g.group_name_2, g.group_name_3].filter(n => n).join(' | ')}</a>`}
        </li>`,'')

      this.container.querySelector('.reader-controls-title').innerHTML = title
      this.container.querySelector('.reader-controls-chapters select').innerHTML = chapters
      this.container.querySelector('.reader-controls-groups ul').innerHTML = groups
      this.container.querySelector('#comment-button').href = this.pageURL(this.chapter.id) + '/comments'
      jQuery('.selectpicker').selectpicker('refresh')
      this.updateChapterLinks()
    }

    updateChapterLinks() {
      const update = (toLeft) => {
        let id = (toLeft === this.isDirectionLTR) ? this.chapter.prevChapterId : this.chapter.nextChapterId
        return (a) => {
          a.dataset.chapter = id
          a.href = this.pageURL(id)
          a.title = this.manga.getChapterTitle(id) || 'Back to manga'
        }
      }
      Array.from(this.container.querySelectorAll('a.chapter-link-left')).forEach(update(true))
      Array.from(this.container.querySelectorAll('a.chapter-link-right')).forEach(update(false))
    }

    updatePageLinks(pg) {
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
        `#444 repeating-linear-gradient(
        to ${this.isDirectionRTL ? 'left' : 'right'},
        #444,
        #444 calc(${notch}% - 3px),
        #666 ${notch}%)`
    }

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

    setDirection(value = Reader.DIRECTION.LTR) {
      if (value !== this.direction) {
        this.direction = value
        this.container.classList.toggle('direction-ltr', this.isDirectionLTR)
        this.container.classList.toggle('direction-rtl', this.isDirectionRTL)
        this.updateChapterLinks()
        this.container.querySelectorAll('#modal-settings button[data-setting="direction"]').forEach((n,i) => n.classList.toggle('active', i === value-1))
        localStorage.setItem('reader.direction', value)
        if (this.renderingMode != null) {
          this.resetRenderer()
        }
      }
    }

    setRenderingMode(value = Reader.RENDERING_MODE.SINGLE, noHistory) {
      if (value !== this.renderingMode) {
        this.renderingMode = value
        this.container.classList.toggle('single-page', this.isSinglePage)
        this.container.classList.toggle('double-page', this.isDoublePage)
        this.container.classList.toggle('long-strip',  this.isLongStrip)
        this.container.querySelectorAll('#modal-settings button[data-setting="rendering"]').forEach((n,i) => n.classList.toggle('active', i === value-1))
        localStorage.setItem('reader.renderingMode', value)
        this.resetRenderer()
        if (!noHistory) {
          this.pushHistory(this.currentPage)
        }
      }
    }

    setDisplayFit(value = Reader.DISPLAY_FIT.FIT_WIDTH) {
      if (value !== this.displayFit) {
        this.displayFit = value
        this.container.classList.toggle('no-resize',  this.isNoResize)
        this.container.classList.toggle('fit-height', this.isFitHeight)
        this.container.classList.toggle('fit-width',  this.isFitWidth)
        this.container.classList.toggle('fit-both',   this.isFitBoth)
        this.container.querySelectorAll('#modal-settings button[data-setting="display"]').forEach((n,i) => n.classList.toggle('active', i === value-1))
        localStorage.setItem('reader.displayFit', value)
      }
    }

    setScrollingSpeed(value = 3) {
      if (value !== this.scrollingSpeed) {
        this.scrollingSpeed = value
        this.container.querySelectorAll('#modal-settings button[data-setting="scrolling"]').forEach(n => n.classList.toggle('active', n.dataset.value == value))
        localStorage.setItem('reader.scrollingSpeed', value)
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
      if (this.currentPage != null) {
        this.render(this.currentPage)
      }
    }

    setLoading(loading) {
      this.isLoading = loading
      this.container.classList.toggle('is-loading', loading)
    }

    tryPreloading(amount = this.preloadPageAmount) {
      const images = []
      for (let i = this.currentPage + 1; i <= this.currentPage + amount &&  i <= this.chapter.totalPages; i++) {
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
      if (pg == null || pg < 1 || pg > this.chapter.totalPages) {
        return null
      } else if (!(pg in this.imageCache)) {
        const img = new Image()
        img.src = this.chapter.imageURL(pg)
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
      const page = this.getPage(pg)
      if (page !== null) {
        const changeImg = () => {
          const curImage = this.imageContainer.querySelector('img')
          this.imageContainer.appendChild(page.image)
          if (curImage) {
            this.imageContainer.removeChild(curImage)
          }
          this.setLoading(false)
          this.updatePageLinks(pg)
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
              this.currentPage = pg + 1
            }
          }
          newPages.forEach(page => this.imageContainer.appendChild(page.image))
          if (curImages) {
            const newImages = newPages.map(page => page.image)
            Array.from(curImages).filter(img => !newImages.includes(img)).forEach(img => this.imageContainer.removeChild(img))
          }
          this.renderedPages = newPages.length

          this.setLoading(false)
          this.updatePageLinks(`${this.currentPage}${this.renderedPages===2 ? ` - ${this.currentPage + 1}` : ''}`)
          this.updatePageBar(this.currentPage + newPages.length - 1)
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
          if (this.currentPage === this.chapter.totalPages) {
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

    moveToPage(pg, noHistory) {
      if (this.isLoading || this.isLongStrip) {
        return
      }
      if (pg === -1) {
        this.moveToPage(this.chapter.totalPages, noHistory)
      } else if (pg === 0) {
        this.moveToChapter(this.chapter.prevChapterId, -1, noHistory)
      } else if (pg > this.chapter.totalPages) {
        this.moveToChapter(this.chapter.nextChapterId, 1, noHistory)
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

    moveToChapter(id, pg = 1, noHistory) {
      if (id === 0) {
        window.location = this.manga.url
      } else {
        return this.setChapter(id).then(() => {
          this.moveToPage(pg, noHistory)
        })
      }
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

    pushHistory(pg, replace) {
      const state = {
        page: pg,
        chapter: this.chapter.id,
        mode: this.renderingMode,
      }
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
          this.setRenderingMode(evt.state.mode, true)
          if (evt.state.chapter == this.chapter.id) {
            this.moveToPage(evt.state.page, true)
          } else {
            this.moveToChapter(evt.state.chapter, evt.state.page, true)
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
      const chapterLink = (evt) => {
        if (evt.currentTarget.dataset.chapter) {
          evt.preventDefault()
          this.moveToChapter(parseInt(evt.currentTarget.dataset.chapter))
        }
      }
      this.container.querySelector('.chapter-link-left').addEventListener('click', chapterLink)
      this.container.querySelector('.chapter-link-right').addEventListener('click', chapterLink)
      this.container.querySelector('.reader-controls-groups ul').addEventListener('click', chapterLink)
      this.container.querySelector('.reader-controls-collapser').addEventListener('click', (evt) => {
        evt.preventDefault()
        const t = this.container.querySelector('.reader-controls-wrapper').classList.toggle('collapsed')
        if (t) {
          this.container.querySelector('.reader-controls-collapser span').classList.replace('fa-caret-right', 'fa-caret-left')
        } else {
          this.container.querySelector('.reader-controls-collapser span').classList.replace('fa-caret-left', 'fa-caret-right')
        }
      })
      this.container.querySelector('#jump-chapter').addEventListener('change', (evt) => {
        const newChapterId = parseInt(evt.target.value)
        if (!this.chapter || this.chapter.id !== newChapterId) {
          this.moveToChapter(newChapterId, 1)
        }
      })
      // action-related stuff
      this.container.querySelector('#fullscreen-button').addEventListener('click', (evt) => {
        const fullscreen = this.container.classList.toggle('fullscreen')
        document.querySelector('#top_nav').style.display = fullscreen ? 'none' : null
        evt.currentTarget.classList.toggle('active', fullscreen)
      })
      this.container.querySelector('#chapter-report-form').addEventListener('submit', (evt) => {
        evt.preventDefault()
        const submitBtn = this.container.querySelector('#chapter-report-submit')
        submitBtn.childNodes[0].classList.remove('fa-pencil-alt')
        submitBtn.childNodes[0].classList.add('fa-spinner', 'fa-pulse')
        submitBtn.childNodes[1].textContent = ' Submitting...'
        submitBtn.disabled = true
        const alertContainer = evt.target.querySelector('.alert-container')
        alertContainer.innerHTML = ''
        fetch(`/ajax/actions.ajax.php?function=chapter_report&id=${this.chapter.id}`, {
          method: 'POST',
          body: new FormData(evt.target),
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(res => res.text())
        .then(data => {
          if (data) {
            alertContainer.innerHTML = data
          } else {
            alertContainer.innerHTML = "<div class='alert alert-success text-center' role='alert'><strong><span class='fas fa-check-circle fa-fw' aria-hidden='true' title='Success'></span> Success:</strong> This chapter has been reported.</div>"
          }
          return Promise.resolve()
        }).catch(err => {
          alertContainer.innerHTML = "<div class='alert alert-danger text-center' role='alert'>Something weird went wrong. Details in the Console (F12), hopefully.</div>"
          console.error(err)
          return Promise.resolve()
        }).then(() => {
          submitBtn.childNodes[0].classList.add('fa-pencil-alt')
          submitBtn.childNodes[0].classList.remove('fa-spinner', 'fa-pulse')
          submitBtn.childNodes[1].textContent = ' Submit'
          submitBtn.disabled = false
        })
      })
      this.container.querySelectorAll('#modal-settings button[data-setting]').forEach(c => c.addEventListener('click', (evt) => {
        switch(evt.target.dataset.setting) {
          case 'rendering': return this.setRenderingMode(parseInt(evt.target.dataset.value))
          case 'display': return this.setDisplayFit(parseInt(evt.target.dataset.value))
          case 'direction': return this.setDirection(parseInt(evt.target.dataset.value))
          case 'scrolling': return this.setScrollingSpeed(parseInt(evt.target.dataset.value))
        }
      }))
      this.container.querySelectorAll('#modal-settings input[data-setting]').forEach(c => c.addEventListener('change', (evt) => {
        console.log(evt.target.dataset.setting, evt.target.value)
      }))

      // keyboard shortcuts
      // FIXME: remove the current listener
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
            case 'arrowup':
            case 'up':
            case 'w':
              return Reader.scroll(-this.scrollingSpeed)
            case 'arrowdown':
            case 'down':
            case 's':
              return Reader.scroll(this.scrollingSpeed)
            case 'f':
              return this.setDisplayFit(this.displayFit % 2 + (evt.shiftKey ? 3 : 1))
            case 'g':
              return this.setRenderingMode(this.renderingMode % 3 + 1)
            case 'h':
              return this.setDirection(this.direction % 2 + 1)
            case 't':
              // return this.container.querySelector('.reader-controls-wrapper').classList.toggle('collapsed')
              const fullscreen = this.container.classList.toggle('fullscreen')
              document.querySelector('#top_nav').style.display = fullscreen ? 'none' : null
              return
          }
        }
      })
    }

    static scroll(n = 3) {
      window.scrollBy({
        behavior: 'smooth',
        left: 0,
        top: n * 40
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